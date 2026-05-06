import { unlink } from 'node:fs/promises'
import type { DatabaseService } from './databaseService'
import type { SettingsService } from './settingsService'
import { createLogger, formatPathForLog } from '../utils/logger'

const logger = createLogger('art-pilot:codex-cleanup-service')

export class CodexCleanupService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly settingsService: SettingsService,
  ) {}

  async cleanupImportedImage(imageId: string, originalCodexPath: string) {
    const policy = this.settingsService.getCodexImageCleanupPolicy()

    if (policy === 'never') {
      // 默认策略保留 Codex 原图，便于排错；状态写为 skipped 让后续清理任务能区分。
      this.databaseService
        .getConnection()
        .prepare("UPDATE generated_images SET cleanup_status = 'skipped', cleanup_error = NULL WHERE id = ? AND cleanup_status = 'pending'")
        .run(imageId)
      logger.info('skipped codex source cleanup by policy: imageId=%s path=%s', imageId, formatPathForLog(originalCodexPath))
      return
    }

    try {
      // 清理严格发生在图片移动和数据库记录成功之后，失败只更新 cleanup_status，不回滚任务。
      await unlink(originalCodexPath)
      this.updateCleanupStatus(imageId, 'complete')
      logger.info('removed codex source image: imageId=%s path=%s', imageId, formatPathForLog(originalCodexPath))
    } catch (error) {
      if (isFileMissingError(error)) {
        this.updateCleanupStatus(imageId, 'complete')
        return
      }

      const cleanupError = error instanceof Error ? error.message : String(error)
      this.updateCleanupStatus(imageId, 'failed', cleanupError)
      logger.warn('failed to remove codex source image: imageId=%s path=%s error=%s', imageId, formatPathForLog(originalCodexPath), cleanupError)
    }
  }

  private updateCleanupStatus(imageId: string, status: string, cleanupError: string | null = null) {
    this.databaseService
      .getConnection()
      .prepare('UPDATE generated_images SET cleanup_status = ?, cleanup_error = ? WHERE id = ?')
      .run(status, cleanupError, imageId)
  }
}

function isFileMissingError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}
