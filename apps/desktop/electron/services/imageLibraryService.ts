import { nativeImage } from 'electron'
import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, copyFile, mkdir, rename, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { renderImagePathTemplate, getSafeImagePathTemplate } from '@art-pilot/shared'
import type { SettingsService } from './settingsService'
import { createLogger, formatPathForLog } from '../utils/logger'

const DEFAULT_IMAGE_EXTENSION = '.png'
const logger = createLogger('art-pilot:image-library-service')

export type ImportedImage = {
  imageId: string
  index: number
  originalCodexPath: string
  libraryPath: string
  fileSize: number
  width?: number
  height?: number
  cleanupError?: string
}

export class ImageLibraryService {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 将 Codex 生成的图片移入图片库，返回包含尺寸、大小、路径等元数据的导入结果。
   */
  async moveImageToLibrary(input: {
    jobId: string
    index: number
    sourcePath: string
    createdAt: number
  }): Promise<ImportedImage> {
    logger.info('moving codex image to library: jobId=%s index=%d source=%s', input.jobId, input.index, formatPathForLog(input.sourcePath))
    const sourceStat = await stat(input.sourcePath)

    if (!sourceStat.isFile()) {
      throw new Error('Codex 图片路径必须指向文件')
    }

    const targetPath = await this.createAvailableTargetPath(input)
    const moveResult = await safeMoveImage(input.sourcePath, targetPath, sourceStat.size)
    const targetStat = await stat(targetPath)
    const imageSize = nativeImage.createFromPath(targetPath).getSize()

    logger.info(
      'moved codex image to library: jobId=%s index=%d target=%s bytes=%d width=%s height=%s',
      input.jobId,
      input.index,
      formatPathForLog(targetPath),
      targetStat.size,
      String(imageSize.width || 'unknown'),
      String(imageSize.height || 'unknown'),
    )

    return {
      imageId: randomUUID(),
      index: input.index,
      originalCodexPath: input.sourcePath,
      libraryPath: targetPath,
      fileSize: targetStat.size,
      width: imageSize.width || undefined,
      height: imageSize.height || undefined,
      cleanupError: moveResult.cleanupError,
    }
  }

  /**
   * 生成不冲突的目标文件路径，基于用户配置的路径模板渲染。
   * 若目标已存在则自动追加版本号（如 0001-2.png）避免覆盖。
   */
  private async createAvailableTargetPath(input: {
    jobId: string
    index: number
    sourcePath: string
    createdAt: number
  }) {
    const settings = this.settingsService.getSettings()
    const template = getSafeImagePathTemplate(settings.imagePathTemplate)
    const createdAt = new Date(input.createdAt)

    const renderedPath = renderImagePathTemplate(template, {
      createdAt,
      jobId: input.jobId,
      index: input.index,
    })

    const extension = path.extname(input.sourcePath).toLowerCase() || DEFAULT_IMAGE_EXTENSION
    const targetDirectory = path.join(
      settings.imageLibraryPath,
      path.dirname(renderedPath),
    )
    const baseName = path.basename(renderedPath)

    await mkdir(targetDirectory, { recursive: true })

    // 目标文件不覆盖：同一任务重复恢复或用户手动放置文件时，自动生成 0001-2.png 这类版本名。
    for (let version = 1; version < 1000; version += 1) {
      const fileName = version === 1 ? `${baseName}${extension}` : `${baseName}-${version}${extension}`
      const targetPath = path.join(targetDirectory, fileName)

      if (!(await pathExists(targetPath))) {
        return targetPath
      }
    }

    throw new Error('无法为图片生成可用的图片库文件名')
  }
}

/**
 * 安全移动图片：同卷内使用原子 rename；跨卷时走 copy → 校验大小 → rename 临时文件 → 删除源文件。
 * 源文件删除失败不会导致整体失败，而是通过 cleanupError 字段上报。
 */
async function safeMoveImage(sourcePath: string, targetPath: string, expectedSourceSize: number) {
  await access(sourcePath, constants.R_OK)
  await mkdir(path.dirname(targetPath), { recursive: true })

  try {
    // 同一 volume 内优先 rename，速度快且是原子移动。
    await rename(sourcePath, targetPath)
    return {}
  } catch (error) {
    if (!isCrossDeviceError(error)) {
      throw error
    }
  }

  // 跨 volume rename 会返回 EXDEV；此时用 copy -> 校验 -> rename 临时文件 -> 删除源图。
  const temporaryTargetPath = `${targetPath}.tmp-${randomUUID()}`
  await copyFile(sourcePath, temporaryTargetPath)
  const temporaryStat = await stat(temporaryTargetPath)

  if (!temporaryStat.isFile() || temporaryStat.size !== expectedSourceSize) {
    throw new Error('复制后的图片大小与源文件不一致')
  }

  await rename(temporaryTargetPath, targetPath)

  try {
    await unlink(sourcePath)
    return {}
  } catch (error) {
    // 目标图片已经安全落库时，源图删除失败不让导入失败，交给 cleanup_status 记录。
    return {
      cleanupError: error instanceof Error ? error.message : String(error),
    }
  }
}

async function pathExists(filePath: string) {
  try {
    await access(filePath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function isCrossDeviceError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EXDEV'
}
