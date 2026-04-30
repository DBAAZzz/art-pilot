import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { Controller } from './baseController'

export class WindowController implements Controller {
  register() {
    ipcMain.handle(IPC_CHANNELS.window.toggleMaximize, (event) => {
      const window = BrowserWindow.fromWebContents(event.sender)

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
