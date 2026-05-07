import type { GenerationTaskStatus } from './imageHistory'
import type { ImageGenerationAspectRatio, ImageGenerationSize, ImageReference, PromptImageBinding } from './imageGeneration'
import type { PromptVariableValue } from './prompt'

export type AssetGenerationParams = {
  provider: 'codex'
  model?: string | null
  checkpoint?: string | null
  size?: ImageGenerationSize | string | null
  aspectRatio?: ImageGenerationAspectRatio | string | null
  seed?: number | string | null
  steps?: number | null
  sampler?: string | null
  cfgScale?: number | null
  count?: number | null
  referenceCount?: number | null
  promptTemplateId?: string | null
  promptTemplateTitle?: string | null
}

export type AssetImage = {
  imageId: string
  jobId: string
  codexThreadId?: string
  index: number
  imagePath: string
  imageUrl: string
  thumbnailUrl: string
  fileName: string
  fileSize?: number
  width?: number
  height?: number
  prompt: string
  aspectRatio?: ImageGenerationAspectRatio | string
  size?: ImageGenerationSize | string
  status: GenerationTaskStatus
  favorite: boolean
  cleanupStatus: string
  cleanupError?: string
  createdAt: number
  movedAt: number
  taskCreatedAt: number
  taskCompletedAt?: number
  referenceCount: number
}

export type AssetImageDetail = AssetImage & {
  generationParams?: AssetGenerationParams
  promptTemplateUse?: {
    templateId: string
    values: PromptVariableValue[]
    imageBindings: PromptImageBinding[]
  }
  references: ImageReference[]
  siblingImages: Array<{
    imageId: string
    index: number
    imagePath: string
    imageUrl: string
  }>
}

export type AssetListQuery = {
  search?: string
  favoriteOnly?: boolean
  offset?: number
  limit?: number
}

export type AssetListResult = {
  items: AssetImage[]
  total: number
  offset: number
  limit: number
}

export type AssetStats = {
  imageCount: number
  totalBytes: number
  monthImageCount: number
  monthBytes: number
}
