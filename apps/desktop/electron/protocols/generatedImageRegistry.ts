import { createLogger, formatPathForLog } from '../utils/logger'
import type { GeneratedImageKey, ReferenceImageKey } from '../types/generatedImageProtocol'

const logger = createLogger('art-pilot:image-registry')

export class GeneratedImageRegistry {
  private readonly imagePaths = new Map<GeneratedImageKey, string>()
  private readonly referencePaths = new Map<ReferenceImageKey, string>()
  private readonly assetPaths = new Map<string, string>()

  register(jobId: string, index: number, imagePath: string) {
    this.imagePaths.set(this.createKey(jobId, index), imagePath)
    logger.info('registered generated image: jobId=%s index=%d path=%s', jobId, index, formatPathForLog(imagePath))
  }

  get(jobId: string, index: number) {
    const imagePath = this.imagePaths.get(this.createKey(jobId, index))

    logger.debug('lookup generated image: jobId=%s index=%d found=%s', jobId, index, String(Boolean(imagePath)))

    return imagePath
  }

  clearJob(jobId: string) {
    let deletedCount = 0

    for (const key of this.imagePaths.keys()) {
      if (key.startsWith(`${jobId}:`)) {
        this.imagePaths.delete(key)
        deletedCount += 1
      }
    }

    let deletedReferenceCount = 0

    for (const key of this.referencePaths.keys()) {
      if (key.startsWith(`${jobId}:reference:`)) {
        this.referencePaths.delete(key)
        deletedReferenceCount += 1
      }
    }

    logger.info(
      'cleared images for job: jobId=%s generatedCount=%d referenceCount=%d',
      jobId,
      deletedCount,
      deletedReferenceCount,
    )
  }

  pruneTaskIds(visibleTaskIds: Iterable<string>) {
    const visibleTaskIdSet = new Set(visibleTaskIds)
    let deletedCount = 0

    for (const key of this.imagePaths.keys()) {
      const [jobId] = key.split(':')

      if (!visibleTaskIdSet.has(jobId)) {
        this.imagePaths.delete(key)
        deletedCount += 1
      }
    }

    let deletedReferenceCount = 0

    for (const key of this.referencePaths.keys()) {
      const [jobId] = key.split(':')

      if (!visibleTaskIdSet.has(jobId)) {
        this.referencePaths.delete(key)
        deletedReferenceCount += 1
      }
    }

    logger.info(
      'pruned image registry: visibleTasks=%d deletedImages=%d deletedReferences=%d remainingImages=%d remainingReferences=%d',
      visibleTaskIdSet.size,
      deletedCount,
      deletedReferenceCount,
      this.imagePaths.size,
      this.referencePaths.size,
    )
  }

  createGeneratedImageUrl(jobId: string, index: number) {
    return `artpilot-image://generated/${encodeURIComponent(jobId)}/${index}`
  }

  registerReference(jobId: string, index: number, imagePath: string) {
    this.referencePaths.set(this.createReferenceKey(jobId, index), imagePath)
    logger.info('registered reference image: jobId=%s index=%d path=%s', jobId, index, formatPathForLog(imagePath))
  }

  getReference(jobId: string, index: number) {
    const imagePath = this.referencePaths.get(this.createReferenceKey(jobId, index))

    logger.debug('lookup reference image: jobId=%s index=%d found=%s', jobId, index, String(Boolean(imagePath)))

    return imagePath
  }

  createReferenceImageUrl(jobId: string, index: number) {
    return `artpilot-image://reference/${encodeURIComponent(jobId)}/${index}`
  }

  registerAsset(imageId: string, imagePath: string) {
    this.assetPaths.set(imageId, imagePath)
    logger.debug('registered asset image: imageId=%s path=%s', imageId, formatPathForLog(imagePath))
  }

  getAsset(imageId: string) {
    return this.assetPaths.get(imageId)
  }

  createAssetOriginalUrl(imageId: string) {
    return `artpilot-image://asset-original/${encodeURIComponent(imageId)}`
  }

  createAssetThumbnailUrl(imageId: string) {
    return `artpilot-image://asset-thumbnail/${encodeURIComponent(imageId)}?v=3`
  }

  private createKey(jobId: string, index: number): GeneratedImageKey {
    return `${jobId}:${index}`
  }

  private createReferenceKey(jobId: string, index: number): ReferenceImageKey {
    return `${jobId}:reference:${index}`
  }
}

export const generatedImageRegistry = new GeneratedImageRegistry()
