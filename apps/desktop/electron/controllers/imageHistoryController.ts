import { shell } from 'electron'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { IPC_CHANNELS } from '@art-pilot/shared'
import { ipcHandler } from './baseController'
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
    ipcHandler.handle(IPC_CHANNELS.imageHistory.listRecent, (limit?: number) => {
      return this.imageHistoryService.listRecentTasks(limit)
    })

    ipcHandler.handle(IPC_CHANNELS.imageHistory.openLibraryFolder, async () => {
      const imageLibraryPath = this.settingsService.getImageLibraryPath()
      // 打开前先创建目录，避免用户首次进入设置时 Finder 因目录不存在而报错。
      await mkdir(imageLibraryPath, { recursive: true })
      const error = await shell.openPath(imageLibraryPath)

      if (error) {
        throw new Error(error)
      }

      logger.info('opened image library folder: path=%s', imageLibraryPath)
    })

    ipcHandler.handle(IPC_CHANNELS.imageHistory.openImageFileLocation, async (imagePath: string) => {
      const normalizedImagePath = await this.validateImageLibraryFilePath(imagePath)
      shell.showItemInFolder(normalizedImagePath)
      logger.info('opened image file location: path=%s', normalizedImagePath)
    })
  }

  private async validateImageLibraryFilePath(imagePath: string) {
    if (typeof imagePath !== 'string' || imagePath.trim().length === 0) {
      throw new Error('图片路径不能为空')
    }

    const normalizedImagePath = path.resolve(imagePath)

    if (!this.imageHistoryService.hasImportedImagePath(normalizedImagePath)) {
      throw new Error('只能打开已生成图片的位置')
    }

    const fileStat = await stat(normalizedImagePath)

    if (!fileStat.isFile()) {
      throw new Error('图片路径必须指向文件')
    }

    return normalizedImagePath
  }
}
