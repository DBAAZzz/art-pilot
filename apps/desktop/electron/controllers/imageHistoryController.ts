import { shell, ipcMain } from 'electron'
import { mkdir } from 'node:fs/promises'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { Controller } from './baseController'
import type { ImageHistoryService } from '../services/imageHistoryService'
import type { SettingsService } from '../services/settingsService'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image-history-controller')

export class ImageHistoryController implements Controller {
  constructor(
    private readonly imageHistoryService: ImageHistoryService,
    private readonly settingsService: SettingsService,
  ) {}

  register() {
    logger.info('registering image history IPC handlers')
    ipcMain.handle(IPC_CHANNELS.imageHistory.listRecent, (_event, limit?: number) => {
      return this.imageHistoryService.listRecentTasks(limit)
    })

    ipcMain.handle(IPC_CHANNELS.imageHistory.openLibraryFolder, async () => {
      const imageLibraryPath = this.settingsService.getImageLibraryPath()
      // 打开前先创建目录，避免用户首次进入设置时 Finder 因目录不存在而报错。
      await mkdir(imageLibraryPath, { recursive: true })
      const error = await shell.openPath(imageLibraryPath)

      if (error) {
        throw new Error(error)
      }

      logger.info('opened image library folder: path=%s', imageLibraryPath)
    })
  }
}
