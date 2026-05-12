import { randomUUID } from 'node:crypto'
import { rename, unlink } from 'node:fs/promises'
import sharp from 'sharp'

export class ImageSanitizerService {
  async sanitizeImage(input: {
    sourcePath: string
    targetPath: string
  }) {
    const temporaryTargetPath = `${input.targetPath}.tmp-${randomUUID()}.png`

    try {
      await sharp(input.sourcePath)
        .rotate()
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
        })
        .toFile(temporaryTargetPath)

      await rename(temporaryTargetPath, input.targetPath)
    } catch (error) {
      await unlink(temporaryTargetPath).catch(() => undefined)
      throw new Error(`图片元数据清除失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
