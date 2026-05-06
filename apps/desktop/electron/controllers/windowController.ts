import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import { getIpcContext, ipcHandler } from './baseController'
import type { Controller } from './baseController'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:window-controller')

export class WindowController implements Controller {
  register() {
    ipcHandler.handle(IPC_CHANNELS.window.toggleMaximize, () => {
      const { sender } = getIpcContext()
      const window = BrowserWindow.fromWebContents(sender)

      if (!window) {
        logger.warn('window maximize toggle ignored because owner window was not found: sender=%d', sender.id)
        return
      }

      if (window.isMaximized()) {
        window.unmaximize()
        logger.info('window maximize toggled: sender=%d action=unmaximize', sender.id)
        return
      }

      window.maximize()
      logger.info('window maximize toggled: sender=%d action=maximize', sender.id)
    })
  }
}
