import { app } from 'electron'
import path from 'node:path'
import { registerControllers } from '../controllers'
import {
  registerGeneratedImageProtocolHandler,
  registerGeneratedImageProtocolScheme,
} from '../protocols/generatedImageProtocol'
import { getAppIconPath } from './appIcon'
import { WindowManager } from './windowManager'

process.env.DIST_ELECTRON = path.join(__dirname)
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(__dirname, '../public')
  : process.env.DIST

export class AppLifecycle {
  private readonly windowManager = new WindowManager()

  start() {
    app.disableHardwareAcceleration()
    registerGeneratedImageProtocolScheme()

    app.whenReady().then(() => {
      const icon = getAppIconPath()

      if (process.platform === 'darwin' && icon) {
        app.dock?.setIcon(icon)
      }

      registerGeneratedImageProtocolHandler()
      registerControllers()
      this.windowManager.createMainWindow()
    })

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
        this.windowManager.clearMainWindow()
      }
    })

    app.on('activate', () => {
      if (!this.windowManager.hasWindows()) {
        this.windowManager.createMainWindow()
      }
    })
  }
}
