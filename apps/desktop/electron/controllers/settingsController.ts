import { BrowserWindow, dialog } from 'electron'
import type { OpenDialogOptions } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { UpdateAppSettingsRequest } from '@art-pilot/shared'
import { getIpcContext, ipcHandler } from './baseController'
import type { Controller } from './baseController'
import type { SettingsService } from '../services/settingsService'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:settings-controller')

export class SettingsController implements Controller {
  constructor(private readonly settingsService: SettingsService) {}

  register() {
    logger.info('registering settings IPC handlers')
    ipcHandler.handle(IPC_CHANNELS.settings.get, () => {
      return this.settingsService.getSettings()
    })

    ipcHandler.handle(IPC_CHANNELS.settings.update, (request: UpdateAppSettingsRequest) => {
      return this.settingsService.updateSettings(request)
    })

    ipcHandler.handle(IPC_CHANNELS.settings.selectImageLibraryFolder, async (currentPath?: string) => {
      const { sender } = getIpcContext()
      const ownerWindow = BrowserWindow.fromWebContents(sender)
      // 目录选择必须在主进程调用系统 dialog，renderer 只拿到用户选择后的路径字符串。
      const options: OpenDialogOptions = {
        title: '选择图片库目录',
        defaultPath: currentPath || this.settingsService.getImageLibraryPath(),
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: '选择',
      }
      const result = ownerWindow
        ? await dialog.showOpenDialog(ownerWindow, options)
        : await dialog.showOpenDialog(options)

      if (result.canceled || result.filePaths.length === 0) {
        logger.info('image library folder selection cancelled: sender=%d', sender.id)
        return null
      }

      logger.info('image library folder selected: sender=%d path=%s', sender.id, result.filePaths[0])
      return result.filePaths[0]
    })
  }
}
