import { BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import { getIpcContext, ipcHandler } from './baseController'
import type { Controller } from './baseController'

export class WindowController implements Controller {
  register() {
    ipcHandler.handle(IPC_CHANNELS.window.toggleMaximize, () => {
      const { sender } = getIpcContext()
      const window = BrowserWindow.fromWebContents(sender)

      if (!window) {
        return
      }

      if (window.isMaximized()) {
        window.unmaximize()
        return
      }

      window.maximize()
    })
  }
}
