import { app, webContents } from 'electron'
import type { WebContents } from 'electron'
import { constants } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { IMAGE_GENERATION_EVENT_TYPES, IPC_CHANNELS } from '@art-pilot/shared'
import type {
  ImageGenerationErrorReason,
  ImageGenerationEvent,
  ImageGenerationRequest,
  ImageGenerationStartResult,
} from '@art-pilot/shared'
import { generatedImageRegistry } from '../protocols/generatedImageRegistry'
import type { CodexImageProvider } from '../providers/codexImageProvider'
import { CODEX_STREAM_EVENT_TYPES } from '../utils/codexCli'
import type { CodexStreamEvent, CodexStreamingChildProcess } from '../utils/codexCli'
import { findCodexGeneratedImagesFromSessions } from '../utils/generatedImages'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image-service')
const ALLOWED_REFERENCE_EXTENSIONS = new Set(['.apng', '.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp'])
const DEFAULT_IMAGE_COUNT = 1
const MAX_IMAGE_COUNT = 8

type ActiveImageGenerationJob = {
  // Art Pilot 自己生成的任务 ID，用来关联 renderer 状态和取消请求。
  jobId: string
  // Codex CLI 在 thread.started 事件里才会给出，所以任务早期可能为空。
  codexThreadId?: string
  childProcess?: CodexStreamingChildProcess
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
}

export class ImageGenerationService {
  // v1 明确只允许一个 active image job，防止重复点击生成导致多个 Codex 进程并发消耗额度。
  private activeJob: ActiveImageGenerationJob | null = null

  constructor(private readonly codexImageProvider: CodexImageProvider) {
    app.on('before-quit', () => {
      this.terminateActiveJob('Application is quitting')
    })
  }

  async startImageGeneration(
    ownerWebContents: WebContents,
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationStartResult> {
    if (this.activeJob) {
      logger.warn(
        'rejected image generation because another job is active: activeJobId=%s activeStatus=%s owner=%d',
        this.activeJob.jobId,
        this.activeJob.status,
        this.activeJob.ownerWebContentsId,
      )
      throw new Error('已有图片生成任务正在运行')
    }

    const normalizedRequest = await this.normalizeRequest(request)
    const jobId = randomUUID()
    // 先创建 activeJob，再启动 Codex；这样即使启动阶段失败，也能向同一个 owner 推送 error。
    const activeJob: ActiveImageGenerationJob = {
      jobId,
      imagePaths: [],
      sessionPaths: [],
      startedAt: Date.now(),
      status: 'starting',
      expectedCount: normalizeImageCount(normalizedRequest.count),
      ownerWebContentsId: ownerWebContents.id,
      isRecoveringImages: false,
      cancellationEventSent: false,
    }

    this.activeJob = activeJob
    logger.info(
      'image generation job created: jobId=%s owner=%d count=%d size=%s references=%d promptLength=%d',
      jobId,
      ownerWebContents.id,
      normalizedRequest.count,
      normalizedRequest.size ?? 'default',
      normalizedRequest.references.length,
      normalizedRequest.prompt.length,
    )

    ownerWebContents.once('destroyed', () => {
      if (this.activeJob?.jobId === jobId) {
        logger.warn('owner webContents destroyed, terminating active image job: jobId=%s owner=%d', jobId, ownerWebContents.id)
        this.terminateActiveJob('Owner webContents was destroyed')
      }
    })

    // started 事件必须早于 Codex 子进程启动，否则 Codex 很快输出 thread.started 时，renderer 可能先收到后续事件。
    this.sendToOwner(activeJob, {
      type: IMAGE_GENERATION_EVENT_TYPES.started,
      jobId,
      count: activeJob.expectedCount,
      size: normalizedRequest.size,
    })

    try {
      // Provider 只负责启动 Codex 和解析 stdout 生命周期事件；图片结果由 service 在退出后读取 session JSONL。
      const { childProcess, startedAt } = await this.codexImageProvider.generateStreaming(
        normalizedRequest,
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
              'codex streaming process timed out: jobId=%s kind=%s stderrTailBytes=%d',
              jobId,
              kind,
              Buffer.byteLength(stderrTail, 'utf8'),
            )
            this.handleCodexError(jobId, stderrTail || 'Image generation timed out', 'timeout')
          },
        },
      )

      activeJob.childProcess = childProcess
      activeJob.startedAt = startedAt
      activeJob.status = 'running'
      this.startImageRecoveryTimer(activeJob)
      logger.info('image generation job running: jobId=%s pid=%s', jobId, String(childProcess.pid ?? 'unknown'))

      return { jobId }
    } catch (error) {
      logger.error('failed to start image generation job: jobId=%s error=%s', jobId, error instanceof Error ? error.message : String(error))
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
    const activeJob = this.activeJob

    if (!activeJob || activeJob.jobId !== jobId) {
      logger.warn('ignored image generation cancel for inactive job: jobId=%s', jobId)
      return
    }

    logger.info('cancelling image generation job by request: jobId=%s', jobId)
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
      logger.info('codex thread started: jobId=%s codexThreadId=%s', jobId, event.threadId)
      this.sendToOwner(activeJob, {
        type: IMAGE_GENERATION_EVENT_TYPES.codexThreadStarted,
        jobId,
        codexThreadId: event.threadId,
      })
      return
    }

    if (event.type === CODEX_STREAM_EVENT_TYPES.message) {
      activeJob.lastMessage = event.text
      logger.debug('codex message received: jobId=%s length=%d', jobId, event.text.length)
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
      logger.info('codex process exited while cancelling: jobId=%s code=%s', jobId, String(code))
      this.sendCancellationEvent(activeJob)
      this.clearActiveJob(jobId)
      return
    }

    if (code !== 0) {
      logger.error('codex process exited with failure: jobId=%s code=%s stderrTail=%s', jobId, String(code), stderrTail)
      this.handleCodexError(jobId, stderrTail || `codex exec exited with code ${code}`, 'process-crashed')
      return
    }

    // v2 核心收口：stdout 不再被视为图片结果来源。进程正常退出后统一读取 Codex session JSONL，
    // 再把恢复到的图片注册到 artpilot-image 协议并推送给 renderer。
    await this.recoverImagesFromCodexSessions(activeJob, true)

    if (activeJob.imagePaths.length === 0) {
      this.handleCodexError(
        jobId,
        activeJob.lastMessage || 'Codex 任务已结束，但没有生成任何图片',
        'api-error',
      )
      return
    }

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

  private recoverImagesFromCodexSessions(activeJob: ActiveImageGenerationJob, logEmptyResult = false) {
    if (this.activeJob !== activeJob) {
      return Promise.resolve()
    }

    if (activeJob.isRecoveringImages) {
      return activeJob.recoveryPromise ?? Promise.resolve()
    }

    activeJob.isRecoveringImages = true
    activeJob.recoveryPromise = this.doRecoverImagesFromCodexSessions(activeJob, logEmptyResult).finally(() => {
      activeJob.isRecoveringImages = false
      activeJob.recoveryPromise = undefined
    })

    return activeJob.recoveryPromise
  }

  private async doRecoverImagesFromCodexSessions(activeJob: ActiveImageGenerationJob, logEmptyResult: boolean) {
    // 优先使用 Codex threadId 精准读取本次任务的 session；如果 threadId 缺失，
    // generatedImages 工具会退回到 startedAt 之后更新过的 session 文件，避免 stdout 解析失败时丢图。
    const { imagePaths: recoveredImagePaths, sessionPaths } = await findCodexGeneratedImagesFromSessions({
      sinceMs: activeJob.startedAt,
      threadId: activeJob.codexThreadId,
      sessionPaths: activeJob.sessionPaths,
    })
    activeJob.sessionPaths = sessionPaths
    const newImagePaths = recoveredImagePaths.filter((imagePath) => !activeJob.imagePaths.includes(imagePath))

    if (newImagePaths.length === 0) {
      if (logEmptyResult && recoveredImagePaths.length === 0 && activeJob.imagePaths.length === 0) {
        logger.warn('no image paths loaded from codex session files: jobId=%s codexThreadId=%s', activeJob.jobId, activeJob.codexThreadId ?? 'unknown')
      } else {
        logger.debug(
          'no new image paths loaded from codex session files: jobId=%s codexThreadId=%s recovered=%d existing=%d',
          activeJob.jobId,
          activeJob.codexThreadId ?? 'unknown',
          recoveredImagePaths.length,
          activeJob.imagePaths.length,
        )
      }

      return
    }

    logger.info('loaded image paths from codex session files: jobId=%s codexThreadId=%s count=%d', activeJob.jobId, activeJob.codexThreadId ?? 'unknown', newImagePaths.length)

    for (const imagePath of newImagePaths) {
      const index = activeJob.imagePaths.length
      activeJob.imagePaths.push(imagePath)
      generatedImageRegistry.register(activeJob.jobId, index, imagePath)
      this.sendToOwner(activeJob, {
        type: IMAGE_GENERATION_EVENT_TYPES.imageFound,
        jobId: activeJob.jobId,
        codexThreadId: activeJob.codexThreadId,
        index,
        imagePath,
        imageUrl: generatedImageRegistry.createGeneratedImageUrl(activeJob.jobId, index),
      })
    }
  }

  private startImageRecoveryTimer(activeJob: ActiveImageGenerationJob) {
    activeJob.recoveryTimer = setInterval(() => {
      if (this.activeJob !== activeJob || activeJob.status !== 'running') {
        return
      }

      void this.recoverImagesFromCodexSessions(activeJob)
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

    logger.error('image generation job failed: jobId=%s reason=%s error=%s', jobId, reason, error)
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
      logger.debug('cancel request ignored because job is already cancelling: jobId=%s', activeJob.jobId)
      return
    }

    activeJob.status = 'cancelling'
    // 先给 Codex 一个正常退出机会；如果 3 秒内没有退出，再升级为 SIGKILL。
    logger.info('sending SIGTERM to image generation process: jobId=%s pid=%s', activeJob.jobId, String(activeJob.childProcess?.pid ?? 'unknown'))
    activeJob.childProcess?.kill('SIGTERM')
    activeJob.cleanupTimer = setTimeout(() => {
      logger.warn('sending SIGKILL to image generation process after grace period: jobId=%s pid=%s', activeJob.jobId, String(activeJob.childProcess?.pid ?? 'unknown'))
      activeJob.childProcess?.kill('SIGKILL')
      this.sendCancellationEvent(activeJob, message)
      this.clearActiveJob(activeJob.jobId)
    }, 3000)
  }

  private terminateActiveJob(message: string) {
    if (this.activeJob) {
      logger.info('terminating active image generation job: jobId=%s message=%s', this.activeJob.jobId, message)
      this.cancelActiveJob(this.activeJob, message)
    }
  }

  private sendCancellationEvent(activeJob: ActiveImageGenerationJob, message = 'Image generation cancelled') {
    if (activeJob.cancellationEventSent) {
      return
    }

    activeJob.cancellationEventSent = true
    logger.info('sending image generation cancellation event: jobId=%s message=%s', activeJob.jobId, message)
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
    if (this.activeJob?.jobId !== jobId) {
      return null
    }

    return this.activeJob
  }

  private clearActiveJob(jobId: string) {
    if (this.activeJob?.jobId !== jobId) {
      return
    }

    if (this.activeJob.cleanupTimer) {
      clearTimeout(this.activeJob.cleanupTimer)
    }

    if (this.activeJob.recoveryTimer) {
      clearInterval(this.activeJob.recoveryTimer)
    }

    // 不清 generatedImageRegistry：renderer 可能在 complete 后继续用 imageUrl 展示刚生成的图片。
    logger.info('cleared active image generation job: jobId=%s images=%d', jobId, this.activeJob.imagePaths.length)
    this.activeJob = null
  }

  private async normalizeRequest(request: ImageGenerationRequest) {
    const prompt = request.prompt?.trim()

    if (!prompt) {
      throw new Error('图片生成提示词不能为空')
    }

    const references = request.references ?? []
    logger.debug('validating image generation request: promptLength=%d references=%d', prompt.length, references.length)

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
}

function normalizeImageCount(count: number | undefined) {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return DEFAULT_IMAGE_COUNT
  }

  return Math.min(Math.max(Math.trunc(count), 1), MAX_IMAGE_COUNT)
}
