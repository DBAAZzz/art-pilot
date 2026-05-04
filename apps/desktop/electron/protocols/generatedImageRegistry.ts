import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image-registry')

type GeneratedImageKey = `${string}:${number}`
type ReferenceImageKey = `${string}:reference:${number}`

export class GeneratedImageRegistry {
  private readonly imagePaths = new Map<GeneratedImageKey, string>()
  private readonly referencePaths = new Map<ReferenceImageKey, string>()
  private readonly draftReferencePaths = new Map<string, string>()

  register(jobId: string, index: number, imagePath: string) {
    this.imagePaths.set(this.createKey(jobId, index), imagePath)
    logger.info('registered generated image: jobId=%s index=%d path=%s', jobId, index, imagePath)
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

  unregisterTask(jobId: string) {
    this.clearJob(jobId)
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
    logger.info('registered reference image: jobId=%s index=%d path=%s', jobId, index, imagePath)
  }

  getReference(jobId: string, index: number) {
    const imagePath = this.referencePaths.get(this.createReferenceKey(jobId, index))

    logger.debug('lookup reference image: jobId=%s index=%d found=%s', jobId, index, String(Boolean(imagePath)))

    return imagePath
  }

  createReferenceImageUrl(jobId: string, index: number) {
    return `artpilot-image://reference/${encodeURIComponent(jobId)}/${index}`
  }

  registerDraftReference(referenceId: string, imagePath: string) {
    this.draftReferencePaths.set(referenceId, imagePath)
    logger.info('registered draft reference image: referenceId=%s path=%s', referenceId, imagePath)
  }

  getDraftReference(referenceId: string) {
    const imagePath = this.draftReferencePaths.get(referenceId)

    logger.debug('lookup draft reference image: referenceId=%s found=%s', referenceId, String(Boolean(imagePath)))

    return imagePath
  }

  createDraftReferenceImageUrl(referenceId: string) {
    return `artpilot-image://reference-draft/${encodeURIComponent(referenceId)}`
  }

  private createKey(jobId: string, index: number): GeneratedImageKey {
    return `${jobId}:${index}`
  }

  private createReferenceKey(jobId: string, index: number): ReferenceImageKey {
    return `${jobId}:reference:${index}`
  }
}

export const generatedImageRegistry = new GeneratedImageRegistry()
