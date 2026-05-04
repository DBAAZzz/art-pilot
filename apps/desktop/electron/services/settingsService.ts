import { app } from 'electron'
import path from 'node:path'
import type { AppSettings, CodexImageCleanupPolicy, UpdateAppSettingsRequest } from '@art-pilot/shared'
import type { DatabaseService } from './databaseService'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:settings-service')

const SETTINGS_KEYS = {
  imageLibraryPath: 'imageLibraryPath',
  codexImageCleanup: 'codexImageCleanup',
  codexSessionCleanup: 'codexSessionCleanup',
} as const

const CODEX_IMAGE_CLEANUP_POLICIES = new Set<CodexImageCleanupPolicy>(['after-import', 'never'])

export class SettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  getSettings(): AppSettings {
    return {
      imageLibraryPath: this.getString(SETTINGS_KEYS.imageLibraryPath, getDefaultImageLibraryPath()),
      codexImageCleanup: this.getCodexImageCleanup(),
      codexSessionCleanup: 'never',
    }
  }

  updateSettings(request: UpdateAppSettingsRequest): AppSettings {
    const updates: Array<[string, string]> = []

    if (typeof request.imageLibraryPath === 'string') {
      const imageLibraryPath = request.imageLibraryPath.trim()

      if (!imageLibraryPath) {
        throw new Error('图片库路径不能为空')
      }

      // 允许用户输入 ~/Pictures 这类路径，入库前统一展开并转成绝对路径。
      updates.push([SETTINGS_KEYS.imageLibraryPath, path.resolve(expandHomePath(imageLibraryPath))])
    }

    if (request.codexImageCleanup !== undefined) {
      if (!CODEX_IMAGE_CLEANUP_POLICIES.has(request.codexImageCleanup)) {
        throw new Error(`不支持的 Codex 图片清理策略：${request.codexImageCleanup}`)
      }

      updates.push([SETTINGS_KEYS.codexImageCleanup, request.codexImageCleanup])
    }

    if (updates.length > 0) {
      logger.info('updating settings: keys=%s', updates.map(([key]) => key).join(','))
      const now = Date.now()
      const statement = this.databaseService
        .getConnection()
        .prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at')

      this.databaseService.transaction(() => {
        for (const [key, value] of updates) {
          statement.run(key, value, now)
        }
      })
      logger.info('settings updated: keys=%s', updates.map(([key]) => key).join(','))
    }

    return this.getSettings()
  }

  getImageLibraryPath() {
    return this.getSettings().imageLibraryPath
  }

  getCodexImageCleanupPolicy() {
    return this.getSettings().codexImageCleanup
  }

  private getCodexImageCleanup(): CodexImageCleanupPolicy {
    const value = this.getString(SETTINGS_KEYS.codexImageCleanup, 'never')
    // 数据库可能保留未来版本写入的值；v1 遇到未知策略时安全回退为 never。
    return CODEX_IMAGE_CLEANUP_POLICIES.has(value as CodexImageCleanupPolicy)
      ? (value as CodexImageCleanupPolicy)
      : 'never'
  }

  private getString(key: string, fallback: string) {
    const row = this.databaseService
      .getConnection()
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value?: string } | undefined

    return row?.value ?? fallback
  }
}

function getDefaultImageLibraryPath() {
  return path.join(app.getPath('pictures'), 'Art Pilot')
}

function expandHomePath(filePath: string) {
  if (filePath === '~') {
    return app.getPath('home')
  }

  if (filePath.startsWith(`~${path.sep}`)) {
    return path.join(app.getPath('home'), filePath.slice(2))
  }

  return filePath
}
