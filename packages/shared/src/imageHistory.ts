import type { ImageGenerationSize, ImageReference } from './imageGeneration'

export type GenerationTaskStatus = 'running' | 'complete' | 'error' | 'cancelled'

export type ImageHistoryImage = {
  imageId: string
  index: number
  imagePath: string
  imageUrl: string
  originalCodexPath?: string
  fileSize?: number
  width?: number
  height?: number
  cleanupStatus: string
  cleanupError?: string
  createdAt: number
  movedAt: number
}

export type ImageHistoryTask = {
  jobId: string
  codexThreadId?: string
  prompt: string
  count: number
  size?: ImageGenerationSize | string
  status: GenerationTaskStatus
  error?: string
  createdAt: number
  completedAt?: number
  references: ImageReference[]
  images: ImageHistoryImage[]
}
