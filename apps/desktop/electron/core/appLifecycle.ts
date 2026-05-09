import { Menu, app } from 'electron'
import path from 'node:path'
import { registerControllers } from '../controllers'
import {
  registerGeneratedImageProtocolHandler,
  registerGeneratedImageProtocolScheme,
} from '../protocols/generatedImageProtocol'
import { createLogger } from '../utils/logger'
import { getAppIconPath } from './appIcon'
import { WindowManager } from './windowManager'

const logger = createLogger('art-pilot:app-lifecycle')

process.env.DIST_ELECTRON = path.join(__dirname)
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? path.join(__dirname, '../public')
  : process.env.DIST

export class AppLifecycle {
  private readonly windowManager = new WindowManager()

  start() {
    logger.info('app lifecycle starting: platform=%s packaged=%s', process.platform, String(app.isPackaged))
    registerGeneratedImageProtocolScheme()

    app.whenReady().then(() => {
      logger.info('app ready')
      this.configureApplicationMenu()
      const icon = getAppIconPath()

      if (process.platform === 'darwin' && icon) {
        app.dock?.setIcon(icon)
        logger.info('dock icon set')
      }

      registerGeneratedImageProtocolHandler()
      registerControllers()
      logger.info('controllers registered')
      this.windowManager.createMainWindow()
    }).catch((error) => {
      logger.error('app startup failed: error=%s', error instanceof Error ? error.message : String(error))
    })

    app.on('window-all-closed', () => {
      logger.info('window-all-closed: platform=%s', process.platform)
      if (process.platform !== 'darwin') {
        app.quit()
        this.windowManager.clearMainWindow()
      }
    })

    app.on('activate', () => {
      if (!this.windowManager.hasWindows()) {
        logger.warn('activate recreating main window because no windows are open')
        this.windowManager.createMainWindow()
      }
    })

    process.on('uncaughtException', (error) => {
      logger.error('uncaught exception: error=%s', error.message)
    })

    process.on('unhandledRejection', (reason) => {
      logger.error('unhandled rejection: reason=%s', reason instanceof Error ? reason.message : String(reason))
    })
  }

  private configureApplicationMenu() {
    if (process.env.VITE_DEV_SERVER_URL) {
      return
    }

    Menu.setApplicationMenu(null)
    logger.info('production application menu disabled')
  }
}
