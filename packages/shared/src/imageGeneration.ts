export const IMAGE_GENERATION_EVENT_TYPES = {
  started: 'started',
  codexThreadStarted: 'codex-thread-started',
  imageFound: 'image-found',
  message: 'message',
  complete: 'complete',
  error: 'error',
} as const

export type ImageGenerationEventType =
  (typeof IMAGE_GENERATION_EVENT_TYPES)[keyof typeof IMAGE_GENERATION_EVENT_TYPES]

export type ImageGenerationSize = 'auto' | '1024x1024' | '1536x1024' | '1024x1536'

export type ImageReference = {
  id: string
  kind: 'local-file'
  path: string
  name?: string
  mimeType?: string
}

export type ImageGenerationRequest = {
  prompt: string
  // count 只表达“期望生成几张图”，主进程不会把它拆成多个 Codex 进程。
  count?: number
  // size 作为用户意图写入 Codex prompt，不在 renderer 侧解释。
  size?: ImageGenerationSize
  // v1 只支持本地参考图路径，由主进程通过 codex --image <path> 传入。
  references?: ImageReference[]
}

export type ImageGenerationStartResult = {
  jobId: string
}

export type ImageGenerationErrorReason = 'timeout' | 'process-crashed' | 'api-error' | 'cancelled'

export type ImageGenerationEvent =
  | {
      type: typeof IMAGE_GENERATION_EVENT_TYPES.started
      jobId: string
      count: number
      size?: ImageGenerationSize
    }
  | {
      type: typeof IMAGE_GENERATION_EVENT_TYPES.codexThreadStarted
      jobId: string
      // Codex CLI 自己生成的 thread id，比 Art Pilot jobId 晚出现。
      codexThreadId: string
    }
  | {
      type: typeof IMAGE_GENERATION_EVENT_TYPES.imageFound
      jobId: string
      codexThreadId?: string
      // 按 Codex JSONL 中 image_generation_end 到达顺序分配，不依赖文件名或 mtime。
      index: number
      // 真实磁盘路径只用于调试、历史记录和后续文件操作；renderer 展示图片应使用 imageUrl。
      imagePath: string
      // artpilot-image://generated/<jobId>/<index>，由主进程受控协议映射到真实路径。
      imageUrl: string
      callId?: string
    }
  | {
      type: typeof IMAGE_GENERATION_EVENT_TYPES.message
      jobId: string
      codexThreadId?: string
      text: string
      metadata?: {
        revisedPrompt?: string
        callId?: string
      }
    }
  | {
      type: typeof IMAGE_GENERATION_EVENT_TYPES.complete
      jobId: string
      codexThreadId?: string
      imagePaths: string[]
      sessionPaths: string[]
    }
  | {
      type: typeof IMAGE_GENERATION_EVENT_TYPES.error
      jobId: string
      codexThreadId?: string
      error: string
      reason?: ImageGenerationErrorReason
    }
