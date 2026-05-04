import type { GenerationTaskStatus, ImageGenerationRequest, ImageHistoryTask } from '@art-pilot/shared'
import type { DatabaseService } from './databaseService'
import type { ImportedImage } from './imageLibraryService'
import { generatedImageRegistry } from '../protocols/generatedImageRegistry'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image-history-service')

type TaskRow = {
  id: string
  codex_thread_id: string | null
  prompt: string
  count: number
  size: string | null
  status: GenerationTaskStatus
  error: string | null
  created_at: number
  completed_at: number | null
}

type ImageRow = {
  id: string
  task_id: string
  image_index: number
  original_codex_path: string | null
  library_path: string
  file_size: number | null
  width: number | null
  height: number | null
  cleanup_status: string
  cleanup_error: string | null
  created_at: number
  moved_at: number
}

export class ImageHistoryService {
  constructor(private readonly databaseService: DatabaseService) {}

  createTask(input: {
    jobId: string
    request: ImageGenerationRequest
    count: number
    createdAt: number
  }) {
    logger.info(
      'creating image generation task history: jobId=%s count=%d size=%s promptLength=%d',
      input.jobId,
      input.count,
      input.request.size ?? 'default',
      input.request.prompt.length,
    )
    this.databaseService
      .getConnection()
      .prepare(`
        INSERT INTO generation_tasks (id, prompt, count, size, status, created_at)
        VALUES (?, ?, ?, ?, 'running', ?)
      `)
      .run(input.jobId, input.request.prompt, input.count, input.request.size ?? null, input.createdAt)
  }

  updateTaskCodexThreadId(jobId: string, codexThreadId: string) {
    logger.info('binding codex thread to image task: jobId=%s codexThreadId=%s', jobId, codexThreadId)
    this.databaseService
      .getConnection()
      .prepare('UPDATE generation_tasks SET codex_thread_id = ? WHERE id = ?')
      .run(codexThreadId, jobId)
  }

  saveImportedImage(taskId: string, image: ImportedImage) {
    const cleanupStatus = image.cleanupError ? 'failed' : 'pending'

    logger.info(
      'saving imported image history: taskId=%s imageId=%s index=%d cleanupStatus=%s libraryPath=%s',
      taskId,
      image.imageId,
      image.index,
      cleanupStatus,
      image.libraryPath,
    )
    this.databaseService
      .getConnection()
      .prepare(`
        INSERT INTO generated_images (
          id,
          task_id,
          image_index,
          original_codex_path,
          library_path,
          file_size,
          width,
          height,
          cleanup_status,
          cleanup_error,
          created_at,
          moved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        image.imageId,
        taskId,
        image.index,
        image.originalCodexPath,
        image.libraryPath,
        image.fileSize,
        image.width ?? null,
        image.height ?? null,
        cleanupStatus,
        image.cleanupError ?? null,
        Date.now(),
        Date.now(),
      )
  }

  completeTask(jobId: string, error?: string) {
    this.updateTaskStatus(jobId, 'complete', error)
  }

  markTaskError(jobId: string, error: string) {
    this.updateTaskStatus(jobId, 'error', error)
  }

  markTaskCancelled(jobId: string, error: string) {
    this.updateTaskStatus(jobId, 'cancelled', error)
  }

  listRecentTasks(limit = 20): ImageHistoryTask[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)
    logger.info('listing recent image tasks: limit=%d', safeLimit)
    const tasks = this.databaseService
      .getConnection()
      .prepare('SELECT * FROM generation_tasks ORDER BY created_at DESC LIMIT ?')
      .all(safeLimit) as TaskRow[]

    if (tasks.length === 0) {
      return []
    }

    const imageRows = this.databaseService
      .getConnection()
      .prepare(`SELECT * FROM generated_images WHERE task_id IN (${tasks.map(() => '?').join(', ')}) ORDER BY task_id, image_index ASC`)
      .all(...tasks.map((task) => task.id)) as ImageRow[]

    const imagesByTaskId = new Map<string, ImageRow[]>()

    for (const image of imageRows) {
      imagesByTaskId.set(image.task_id, [...(imagesByTaskId.get(image.task_id) ?? []), image])
    }

    // 历史图片从 SQLite 恢复后必须重新注册到内存 registry，自定义协议才能解析到真实文件。
    const historyTasks = tasks.map((task) => ({
      jobId: task.id,
      codexThreadId: task.codex_thread_id ?? undefined,
      prompt: task.prompt,
      count: task.count,
      size: task.size ?? undefined,
      status: task.status,
      error: task.error ?? undefined,
      createdAt: task.created_at,
      completedAt: task.completed_at ?? undefined,
      images: (imagesByTaskId.get(task.id) ?? []).map((image) => {
        generatedImageRegistry.register(task.id, image.image_index, image.library_path)

        return {
          imageId: image.id,
          index: image.image_index,
          imagePath: image.library_path,
          imageUrl: generatedImageRegistry.createGeneratedImageUrl(task.id, image.image_index),
          originalCodexPath: image.original_codex_path ?? undefined,
          fileSize: image.file_size ?? undefined,
          width: image.width ?? undefined,
          height: image.height ?? undefined,
          cleanupStatus: image.cleanup_status,
          cleanupError: image.cleanup_error ?? undefined,
          createdAt: image.created_at,
          movedAt: image.moved_at,
        }
      }),
    }))

    generatedImageRegistry.pruneTaskIds(historyTasks.map((task) => task.jobId))

    return historyTasks
  }

  private updateTaskStatus(jobId: string, status: GenerationTaskStatus, error?: string) {
    logger.info('updating image task status: jobId=%s status=%s hasError=%s', jobId, status, String(Boolean(error)))
    this.databaseService
      .getConnection()
      .prepare('UPDATE generation_tasks SET status = ?, error = ?, completed_at = ? WHERE id = ?')
      .run(status, error ?? null, Date.now(), jobId)
  }
}
