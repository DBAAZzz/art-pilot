import { app, webContents } from 'electron'
import type { WebContents } from 'electron'
import { constants } from 'node:fs'
import { access, rename, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import {
  IMAGE_GENERATION_EVENT_TYPES,
  IPC_CHANNELS,
  MAX_IMAGE_REFERENCES,
  MAX_IMAGE_REFERENCE_FILE_SIZE,
} from '@art-pilot/shared'
import type {
  ImageGenerationErrorReason,
  ImageGenerationEvent,
  ImageGenerationRequest,
  ImageGenerationStartResult,
  ImageReference,
} from '@art-pilot/shared'
import { generatedImageRegistry } from '../protocols/generatedImageRegistry'
import type { CodexImageProvider } from '../providers/codexImageProvider'
import type { CodexCleanupService } from './codexCleanupService'
import type { ImageHistoryService } from './imageHistoryService'
import type { ImageLibraryService, ImportedImage } from './imageLibraryService'
import { CODEX_STREAM_EVENT_TYPES } from '../utils/codexCli'
import type { CodexStreamEvent, CodexStreamingChildProcess } from '../utils/codexCli'
import { findCodexGeneratedImagesFromSessions } from '../utils/generatedImages'
import { createLogger, formatPathForLog } from '../utils/logger'

const logger = createLogger('art-pilot:image-service')
const ALLOWED_REFERENCE_EXTENSIONS = new Set(['.apng', '.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp'])
const DEFAULT_IMAGE_COUNT = 1
const MAX_IMAGE_COUNT = 8
const MAX_ACTIVE_IMAGE_JOBS = 5

type ActiveImageGenerationJob = {
  // Art Pilot 自己生成的任务 ID，用来关联 renderer 状态和取消请求。
  jobId: string
  // Codex CLI 在 thread.started 事件里才会给出，所以任务早期可能为空。
  codexThreadId?: string
  childProcess?: CodexStreamingChildProcess
  originalImagePaths: string[]
  imagePaths: string[]
  sessionPaths: string[]
  startedAt: number
  status: 'starting' | 'running' | 'cancelling'
  expectedCount: number
  lastMessage?: string
  // 事件只回推给发起任务的 webContents，避免 DevTools 或其它窗口收到任务事件。
  ownerWebContentsId: number
  cleanupTimer?: NodeJS.Timeout
  recoveryTimer?: NodeJS.Timeout
  isRecoveringImages: boolean
  recoveryPromise?: Promise<void>
  // 取消和进程退出可能同时发生，用这个标记保证只发送一次取消结果。
  cancellationEventSent: boolean
  importFailureCount: number
}

export class ImageGenerationService {
  private readonly activeJobs = new Map<string, ActiveImageGenerationJob>()
  private isQuitting = false
  private quitAfterActiveJobsTerminated = false

  constructor(
    private readonly codexImageProvider: CodexImageProvider,
    private readonly imageLibraryService: ImageLibraryService,
    private readonly imageHistoryService: ImageHistoryService,
    private readonly codexCleanupService: CodexCleanupService,
  ) {
    app.on('before-quit', (event) => {
      if (this.activeJobs.size === 0 || this.quitAfterActiveJobsTerminated) {
        return
      }

      event.preventDefault()
      this.isQuitting = true
      this.terminateActiveJobs('Application is quitting')
    })
  }

  async startImageGeneration(
    ownerWebContents: WebContents,
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationStartResult> {
    if (this.activeJobs.size >= MAX_ACTIVE_IMAGE_JOBS) {
      logger.warn(
        'rejected image generation because active job limit reached: activeJobs=%d limit=%d owner=%d',
        this.activeJobs.size,
        MAX_ACTIVE_IMAGE_JOBS,
        ownerWebContents.id,
      )
      throw new Error(`当前已有 ${MAX_ACTIVE_IMAGE_JOBS} 个图片生成任务正在运行，请等待部分任务完成后再试`)
    }

    const normalizedRequest = await this.normalizeRequest(request)
    const jobId = randomUUID()
    const taskRequest = {
      ...normalizedRequest,
      references: attachReferenceImageUrls(jobId, normalizedRequest.references),
    }
    // 先创建 activeJob，再启动 Codex；这样即使启动阶段失败，也能向同一个 owner 推送 error。
    const activeJob: ActiveImageGenerationJob = {
      jobId,
      originalImagePaths: [],
      imagePaths: [],
      sessionPaths: [],
      startedAt: Date.now(),
      status: 'starting',
      expectedCount: normalizeImageCount(normalizedRequest.count),
      ownerWebContentsId: ownerWebContents.id,
      isRecoveringImages: false,
      cancellationEventSent: false,
      importFailureCount: 0,
    }

    this.activeJobs.set(jobId, activeJob)
    try {
      this.imageHistoryService.createTask({
        jobId,
        request: taskRequest,
        count: activeJob.expectedCount,
        createdAt: activeJob.startedAt,
      })
    } catch (error) {
      this.clearActiveJob(jobId)
      throw error
    }
    logger.info(
      '%s image generation job created: count=%d aspectRatio=%s size=%s references=%d promptLength=%d',
      this.formatJobLogContext(activeJob),
      normalizedRequest.count,
      normalizedRequest.aspectRatio ?? 'default',
      normalizedRequest.size ?? 'default',
      normalizedRequest.references.length,
      normalizedRequest.prompt.length,
    )

    ownerWebContents.once('destroyed', () => {
      this.terminateOwnerJobs(ownerWebContents.id, 'Owner webContents was destroyed')
    })

    // started 事件必须早于 Codex 子进程启动，否则 Codex 很快输出 thread.started 时，renderer 可能先收到后续事件。
    this.sendToOwner(activeJob, {
      type: IMAGE_GENERATION_EVENT_TYPES.started,
      jobId,
      prompt: taskRequest.prompt,
      count: activeJob.expectedCount,
      aspectRatio: taskRequest.aspectRatio,
      size: taskRequest.size,
      references: taskRequest.references,
      createdAt: activeJob.startedAt,
    })

    try {
      // Provider 只负责启动 Codex 和解析 stdout 生命周期事件；图片结果由 service 在退出后读取 session JSONL。
      const { childProcess, startedAt } = await this.codexImageProvider.generateStreaming(
        taskRequest,
        {
          onEvent: (event) => this.handleCodexEvent(jobId, event),
          onExit: (result) => {
            logger.info(
              'codex streaming process exited: jobId=%s code=%s stderrTailBytes=%d',
              jobId,
              String(result.code),
              Buffer.byteLength(result.stderrTail, 'utf8'),
            )
            void this.handleCodexExit(jobId, result.code, result.stderrTail)
          },
          onError: (error, stderrTail) => {
            logger.error(
              'codex streaming process error: jobId=%s error=%s stderrTailBytes=%d',
              jobId,
              error.message,
              Buffer.byteLength(stderrTail, 'utf8'),
            )
            this.handleCodexError(jobId, stderrTail || error.message, 'process-crashed')
          },
          onTimeout: (kind, stderrTail) => {
            logger.error(
              'codex streaming process timed out: jobId=%s kind=%s stderrTailBytes=%d stderrTail=%s',
              jobId,
              kind,
              Buffer.byteLength(stderrTail, 'utf8'),
              stderrTail,
            )
            this.handleCodexError(jobId, getCodexTimeoutMessage(kind), 'timeout')
          },
        },
      )

      activeJob.childProcess = childProcess
      activeJob.startedAt = startedAt
      activeJob.status = 'running'
      this.startImageRecoveryTimer(activeJob)
      logger.info('%s image generation job running: pid=%s', this.formatJobLogContext(activeJob), String(childProcess.pid ?? 'unknown'))

      return { jobId }
    } catch (error) {
      logger.error('failed to start image generation job: jobId=%s error=%s', jobId, error instanceof Error ? error.message : String(error))
      this.imageHistoryService.markTaskError(jobId, error instanceof Error ? error.message : String(error))
      this.sendToOwner(activeJob, {
        type: IMAGE_GENERATION_EVENT_TYPES.error,
        jobId,
        error: error instanceof Error ? error.message : String(error),
        reason: 'process-crashed',
      })
      this.clearActiveJob(jobId)
      return { jobId }
    }
  }

  async cancelImageGeneration(jobId: string) {
    const activeJob = this.getActiveJob(jobId)

    if (!activeJob) {
      logger.warn('ignored image generation cancel for inactive job: jobId=%s', jobId)
      return
    }

    logger.info('%s cancelling image generation job by request', this.formatJobLogContext(activeJob))
    this.cancelActiveJob(activeJob, 'Image generation cancelled')
  }

  private handleCodexEvent(jobId: string, event: CodexStreamEvent) {
    const activeJob = this.getActiveJob(jobId)

    // 一旦进入 cancelling，后续 stdout 事件全部丢弃，避免 UI 同时看到“又生成了一张图”和“已取消”。
    if (!activeJob || activeJob.status === 'cancelling') {
      logger.debug(
        'ignored codex event for inactive or cancelling job: jobId=%s eventType=%s',
        jobId,
        event.type,
      )
      return
    }

    if (event.type === CODEX_STREAM_EVENT_TYPES.threadStarted) {
      activeJob.codexThreadId = event.threadId
      this.imageHistoryService.updateTaskCodexThreadId(jobId, event.threadId)
      logger.info('%s codex thread started', this.formatJobLogContext(activeJob))
      this.sendToOwner(activeJob, {
        type: IMAGE_GENERATION_EVENT_TYPES.codexThreadStarted,
        jobId,
        codexThreadId: event.threadId,
      })
      return
    }

    if (event.type === CODEX_STREAM_EVENT_TYPES.message) {
      activeJob.lastMessage = event.text
      logger.debug('%s codex message received: length=%d', this.formatJobLogContext(activeJob), event.text.length)
      this.sendToOwner(activeJob, {
        type: IMAGE_GENERATION_EVENT_TYPES.message,
        jobId,
        codexThreadId: activeJob.codexThreadId,
        text: event.text,
        metadata: {
          revisedPrompt: event.revisedPrompt,
          callId: event.callId,
        },
      })
    }
  }

  private async handleCodexExit(jobId: string, code: number | null, stderrTail: string) {
    const activeJob = this.getActiveJob(jobId)

    if (!activeJob) {
      logger.debug('ignored codex exit for inactive job: jobId=%s code=%s', jobId, String(code))
      return
    }

    if (activeJob.status === 'cancelling') {
      // 主动取消时，无论 Codex 最后 exit code 是什么，统一折叠成 cancelled 事件。
      logger.info('%s codex process exited while cancelling: code=%s', this.formatJobLogContext(activeJob), String(code))
      this.sendCancellationEvent(activeJob)
      this.clearActiveJob(jobId)
      return
    }

    if (code !== 0) {
      logger.error('%s codex process exited with failure: code=%s stderrTail=%s', this.formatJobLogContext(activeJob), String(code), stderrTail)
            this.handleCodexError(jobId, normalizeCodexProcessError(stderrTail) || `codex exec exited with code ${code}`, 'process-crashed')
      return
    }

    // v2 核心收口：stdout 不再被视为图片结果来源。进程正常退出后统一读取 Codex session JSONL，
    // 再把恢复到的图片注册到 artpilot-image 协议并推送给 renderer。
    await this.recoverImagesFromCodexSessions(activeJob, {
      allowStartedAtFallback: true,
      logEmptyResult: true,
    })

    if (activeJob.imagePaths.length === 0) {
      this.handleCodexError(
        jobId,
        activeJob.importFailureCount > 0
          ? `${activeJob.importFailureCount} 张图片导入失败`
          : activeJob.lastMessage || 'Codex 任务已结束，但没有生成任何图片',
        'api-error',
      )
      return
    }

    const completionError = activeJob.importFailureCount > 0
      ? `${activeJob.importFailureCount}/${activeJob.imagePaths.length + activeJob.importFailureCount} images failed to import`
      : undefined
    this.imageHistoryService.completeTask(jobId, completionError)

    // complete 只表示 Codex 进程正常结束；实际生成图片数量以 imagePaths.length 为准。
    logger.info(
      'image generation job complete: jobId=%s codexThreadId=%s images=%d sessionFiles=%d',
      jobId,
      activeJob.codexThreadId ?? 'unknown',
      activeJob.imagePaths.length,
      activeJob.sessionPaths.length,
    )
    this.sendToOwner(activeJob, {
      type: IMAGE_GENERATION_EVENT_TYPES.complete,
      jobId,
      codexThreadId: activeJob.codexThreadId,
      imagePaths: [...activeJob.imagePaths],
      sessionPaths: [...activeJob.sessionPaths],
    })
    this.clearActiveJob(jobId)
  }

  private recoverImagesFromCodexSessions(activeJob: ActiveImageGenerationJob, options: {
    allowStartedAtFallback?: boolean
    logEmptyResult?: boolean
  } = {}) {
    if (this.activeJobs.get(activeJob.jobId) !== activeJob) {
      return Promise.resolve()
    }

    if (!activeJob.codexThreadId && !options.allowStartedAtFallback) {
      logger.debug('%s skipped image recovery without codexThreadId', this.formatJobLogContext(activeJob))
      return Promise.resolve()
    }

    if (activeJob.isRecoveringImages) {
      return activeJob.recoveryPromise ?? Promise.resolve()
    }

    activeJob.isRecoveringImages = true
    activeJob.recoveryPromise = this.doRecoverImagesFromCodexSessions(activeJob, Boolean(options.logEmptyResult)).finally(() => {
      activeJob.isRecoveringImages = false
      activeJob.recoveryPromise = undefined
    })

    return activeJob.recoveryPromise
  }

  private async doRecoverImagesFromCodexSessions(activeJob: ActiveImageGenerationJob, logEmptyResult: boolean) {
    // 优先使用 Codex threadId 精准读取本次任务的 session；并发运行时只有最终兜底才允许缺失 threadId。
    const { imagePaths: recoveredImagePaths, sessionPaths } = await findCodexGeneratedImagesFromSessions({
      sinceMs: activeJob.startedAt,
      threadId: activeJob.codexThreadId,
      sessionPaths: activeJob.sessionPaths,
    })
    activeJob.sessionPaths = sessionPaths
    const newImagePaths = recoveredImagePaths.filter((imagePath) => !activeJob.originalImagePaths.includes(imagePath))

    if (newImagePaths.length === 0) {
      if (logEmptyResult && recoveredImagePaths.length === 0 && activeJob.imagePaths.length === 0) {
        logger.warn('%s no image paths loaded from codex session files', this.formatJobLogContext(activeJob))
      } else {
        logger.debug(
          '%s no new image paths loaded from codex session files: recovered=%d existing=%d',
          this.formatJobLogContext(activeJob),
          recoveredImagePaths.length,
          activeJob.imagePaths.length,
        )
      }

      return
    }

    logger.info('%s loaded image paths from codex session files: count=%d', this.formatJobLogContext(activeJob), newImagePaths.length)

    for (const imagePath of newImagePaths) {
      try {
        await this.importRecoveredImage(activeJob, imagePath)
      } catch (error) {
        activeJob.importFailureCount += 1
        logger.error(
          '%s failed to import recovered image: source=%s error=%s',
          this.formatJobLogContext(activeJob),
          formatPathForLog(imagePath),
          error instanceof Error ? error.message : String(error),
        )
      }
    }
  }

  private async importRecoveredImage(activeJob: ActiveImageGenerationJob, imagePath: string) {
    const index = activeJob.imagePaths.length + 1
    const importedImage = await this.imageLibraryService.moveImageToLibrary({
      jobId: activeJob.jobId,
      index,
      sourcePath: imagePath,
      createdAt: activeJob.startedAt,
    })

    try {
      this.imageHistoryService.saveImportedImage(activeJob.jobId, importedImage)
    } catch (error) {
      await this.rollbackMovedImage(activeJob, importedImage, error)
      throw error
    }

    activeJob.originalImagePaths.push(imagePath)
    activeJob.imagePaths.push(importedImage.libraryPath)
    generatedImageRegistry.register(activeJob.jobId, index, importedImage.libraryPath)
    this.sendToOwner(activeJob, {
      type: IMAGE_GENERATION_EVENT_TYPES.imageFound,
      jobId: activeJob.jobId,
      imageId: importedImage.imageId,
      codexThreadId: activeJob.codexThreadId,
      index,
      imagePath: importedImage.libraryPath,
      imageUrl: generatedImageRegistry.createGeneratedImageUrl(activeJob.jobId, index),
    })
    await this.codexCleanupService.cleanupImportedImage(importedImage.imageId, importedImage.originalCodexPath)
  }

  private async rollbackMovedImage(activeJob: ActiveImageGenerationJob, importedImage: ImportedImage, cause: unknown) {
    try {
      await rename(importedImage.libraryPath, importedImage.originalCodexPath)
      logger.warn(
        '%s rolled back imported image after database error: source=%s library=%s cause=%s',
        this.formatJobLogContext(activeJob),
        formatPathForLog(importedImage.originalCodexPath),
        formatPathForLog(importedImage.libraryPath),
        cause instanceof Error ? cause.message : String(cause),
      )
    } catch (rollbackError) {
      logger.warn(
        '%s failed to rollback imported image after database error: source=%s library=%s cause=%s rollbackError=%s',
        this.formatJobLogContext(activeJob),
        formatPathForLog(importedImage.originalCodexPath),
        formatPathForLog(importedImage.libraryPath),
        cause instanceof Error ? cause.message : String(cause),
        rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      )
    }
  }

  private startImageRecoveryTimer(activeJob: ActiveImageGenerationJob) {
    activeJob.recoveryTimer = setInterval(() => {
      if (this.activeJobs.get(activeJob.jobId) !== activeJob || activeJob.status !== 'running') {
        return
      }

      void this.recoverImagesFromCodexSessions(activeJob, {
        allowStartedAtFallback: false,
      })
    }, 2000)
  }

  private handleCodexError(jobId: string, error: string, reason: ImageGenerationErrorReason) {
    const activeJob = this.getActiveJob(jobId)

    if (!activeJob) {
      logger.debug('ignored image generation error for inactive job: jobId=%s reason=%s error=%s', jobId, reason, error)
      return
    }

    if (activeJob.status === 'cancelling') {
      logger.info('converted image generation error to cancellation: jobId=%s reason=%s', jobId, reason)
      this.sendCancellationEvent(activeJob)
      this.clearActiveJob(jobId)
      return
    }

    logger.error('%s image generation job failed: reason=%s error=%s', this.formatJobLogContext(activeJob), reason, error)
    if (reason === 'cancelled') {
      this.imageHistoryService.markTaskCancelled(jobId, error)
    } else {
      this.imageHistoryService.markTaskError(jobId, error)
    }
    this.sendToOwner(activeJob, {
      type: IMAGE_GENERATION_EVENT_TYPES.error,
      jobId,
      codexThreadId: activeJob.codexThreadId,
      error,
      reason,
    })
    this.clearActiveJob(jobId)
  }

  private cancelActiveJob(activeJob: ActiveImageGenerationJob, message: string) {
    if (activeJob.status === 'cancelling') {
      logger.debug('%s cancel request ignored because job is already cancelling', this.formatJobLogContext(activeJob))
      return
    }

    activeJob.status = 'cancelling'
    // 先给 Codex 一个正常退出机会；如果 3 秒内没有退出，再升级为 SIGKILL。
    logger.info('%s sending SIGTERM to image generation process: pid=%s', this.formatJobLogContext(activeJob), String(activeJob.childProcess?.pid ?? 'unknown'))
    activeJob.childProcess?.kill('SIGTERM')
    activeJob.cleanupTimer = setTimeout(() => {
      logger.warn('%s sending SIGKILL to image generation process after grace period: pid=%s', this.formatJobLogContext(activeJob), String(activeJob.childProcess?.pid ?? 'unknown'))
      activeJob.childProcess?.kill('SIGKILL')
      this.sendCancellationEvent(activeJob, message)
      this.clearActiveJob(activeJob.jobId)
    }, 3000)
  }

  private terminateActiveJobs(message: string) {
    logger.info('terminating active image generation jobs: count=%d message=%s', this.activeJobs.size, message)

    for (const activeJob of this.activeJobs.values()) {
      this.cancelActiveJob(activeJob, message)
    }
  }

  private terminateOwnerJobs(ownerWebContentsId: number, message: string) {
    for (const activeJob of this.activeJobs.values()) {
      if (activeJob.ownerWebContentsId === ownerWebContentsId) {
        logger.warn('%s owner webContents destroyed, terminating image job', this.formatJobLogContext(activeJob))
        this.cancelActiveJob(activeJob, message)
      }
    }
  }

  private sendCancellationEvent(activeJob: ActiveImageGenerationJob, message = 'Image generation cancelled') {
    if (activeJob.cancellationEventSent) {
      return
    }

    activeJob.cancellationEventSent = true
    logger.info('%s sending image generation cancellation event: message=%s', this.formatJobLogContext(activeJob), message)
    this.imageHistoryService.markTaskCancelled(activeJob.jobId, message)
    this.sendToOwner(activeJob, {
      type: IMAGE_GENERATION_EVENT_TYPES.error,
      jobId: activeJob.jobId,
      codexThreadId: activeJob.codexThreadId,
      error: message,
      reason: 'cancelled',
    })
  }

  private sendToOwner(activeJob: ActiveImageGenerationJob, event: ImageGenerationEvent) {
    const owner = webContents.fromId(activeJob.ownerWebContentsId)

    if (!owner || owner.isDestroyed()) {
      logger.debug('skipped image generation event for destroyed owner: jobId=%s eventType=%s', activeJob.jobId, event.type)
      return
    }

    // 不广播给所有窗口，避免多窗口/DevTools 场景下事件串线。
    logger.debug('sending image generation event: jobId=%s owner=%d eventType=%s', activeJob.jobId, activeJob.ownerWebContentsId, event.type)
    owner.send(IPC_CHANNELS.image.generationEvent, event)
  }

  private getActiveJob(jobId: string) {
    return this.activeJobs.get(jobId) ?? null
  }

  private clearActiveJob(jobId: string) {
    const activeJob = this.activeJobs.get(jobId)

    if (!activeJob) {
      return
    }

    if (activeJob.cleanupTimer) {
      clearTimeout(activeJob.cleanupTimer)
    }

    if (activeJob.recoveryTimer) {
      clearInterval(activeJob.recoveryTimer)
    }

    // 不清 generatedImageRegistry：renderer 可能在 complete 后继续用 imageUrl 展示刚生成的图片。
    this.activeJobs.delete(jobId)
    logger.info('%s cleared active image generation job: images=%d', this.formatJobLogContext(activeJob), activeJob.imagePaths.length)

    if (this.isQuitting && this.activeJobs.size === 0) {
      this.quitAfterActiveJobsTerminated = true
      app.quit()
    }
  }

  private formatJobLogContext(activeJob: ActiveImageGenerationJob) {
    return `jobId=${activeJob.jobId} owner=${activeJob.ownerWebContentsId} thread=${activeJob.codexThreadId ?? 'unknown'} activeJobs=${this.activeJobs.size}`
  }

  private async normalizeRequest(request: ImageGenerationRequest) {
    const prompt = request.prompt?.trim()

    if (!prompt) {
      throw new Error('图片生成提示词不能为空')
    }

    const references = request.references ?? []
    logger.debug('validating image generation request: promptLength=%d references=%d', prompt.length, references.length)

    if (references.length > MAX_IMAGE_REFERENCES) {
      throw new Error(`参考图最多支持 ${MAX_IMAGE_REFERENCES} 张`)
    }

    for (const reference of references) {
      logger.debug('validating image reference: id=%s path=%s', reference.id, reference.path)
      await validateReference(reference.path)
    }

    return {
      ...request,
      prompt,
      count: normalizeImageCount(request.count),
      references,
    }
  }
}

async function validateReference(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()

  // 参考图路径会传给 codex --image；启动前先拒绝目录、不可读文件和非图片扩展名。
  if (!ALLOWED_REFERENCE_EXTENSIONS.has(extension)) {
    throw new Error(`不支持的参考图格式：${extension || 'unknown'}`)
  }

  await access(filePath, constants.R_OK)
  const fileStat = await stat(filePath)

  if (!fileStat.isFile()) {
    throw new Error('参考图路径必须指向文件')
  }

  if (fileStat.size > MAX_IMAGE_REFERENCE_FILE_SIZE) {
    throw new Error(`参考图文件不能超过 ${Math.trunc(MAX_IMAGE_REFERENCE_FILE_SIZE / 1024 / 1024)}MB`)
  }
}

function normalizeImageCount(count: number | undefined) {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return DEFAULT_IMAGE_COUNT
  }

  return Math.min(Math.max(Math.trunc(count), 1), MAX_IMAGE_COUNT)
}

function getCodexTimeoutMessage(kind: 'startup' | 'inactivity' | 'absolute') {
  if (kind === 'startup') {
    return 'Codex 启动超时，请稍后重试'
  }

  if (kind === 'inactivity') {
    return '图片生成长时间没有进展，任务已超时'
  }

  return '图片生成超时，请减少生成数量或稍后重试'
}

function normalizeCodexProcessError(stderrTail: string) {
  return stderrTail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== 'Debugger attached.')
    .filter((line) => line !== 'Reading prompt from stdin...')
    .join('\n')
}

function attachReferenceImageUrls(jobId: string, references: ImageReference[]) {
  return references.map((reference, index) => {
    generatedImageRegistry.registerReference(jobId, index, reference.path)

    return {
      ...reference,
      imageUrl: reference.imageUrl ?? generatedImageRegistry.createReferenceImageUrl(jobId, index),
    }
  })
}
