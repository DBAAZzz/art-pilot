import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image-registry')

type GeneratedImageKey = `${string}:${number}`

export class GeneratedImageRegistry {
  private readonly imagePaths = new Map<GeneratedImageKey, string>()

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

    logger.info('cleared generated images for job: jobId=%s count=%d', jobId, deletedCount)
  }

  createGeneratedImageUrl(jobId: string, index: number) {
    return `artpilot-image://generated/${encodeURIComponent(jobId)}/${index}`
  }

  private createKey(jobId: string, index: number): GeneratedImageKey {
    return `${jobId}:${index}`
  }
}

export const generatedImageRegistry = new GeneratedImageRegistry()
