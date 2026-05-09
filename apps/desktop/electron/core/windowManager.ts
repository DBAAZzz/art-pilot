import { BrowserWindow } from 'electron'
import path from 'node:path'
import { createLogger, formatUrlForLog } from '../utils/logger'
import { getAppIconPath } from './appIcon'

const logger = createLogger('art-pilot:window-manager')
const MAIN_WINDOW_WIDTH = 1200
const MAIN_WINDOW_HEIGHT = 800
const MAIN_WINDOW_MIN_WIDTH = 1024
const MAIN_WINDOW_MIN_HEIGHT = 690

export class WindowManager {
  private mainWindow: BrowserWindow | null = null

  createMainWindow() {
    const icon = getAppIconPath()

    logger.info(
      'creating main window: width=%d height=%d minWidth=%d minHeight=%d hasIcon=%s',
      MAIN_WINDOW_WIDTH,
      MAIN_WINDOW_HEIGHT,
      MAIN_WINDOW_MIN_WIDTH,
      MAIN_WINDOW_MIN_HEIGHT,
      String(Boolean(icon)),
    )
    this.mainWindow = new BrowserWindow({
      width: MAIN_WINDOW_WIDTH,
      height: MAIN_WINDOW_HEIGHT,
      minWidth: MAIN_WINDOW_MIN_WIDTH,
      minHeight: MAIN_WINDOW_MIN_HEIGHT,
      ...(icon ? { icon } : {}),
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    })

    this.registerWindowTelemetry(this.mainWindow)
    this.registerProductionDevToolsGuard(this.mainWindow)

    if (process.env.VITE_DEV_SERVER_URL) {
      logger.info('loading renderer from dev server: url=%s', formatUrlForLog(process.env.VITE_DEV_SERVER_URL))
      void this.mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch((error) => {
        logger.error('renderer dev server load failed: error=%s', error instanceof Error ? error.message : String(error))
      })
      // this.mainWindow.webContents.openDevTools()
    } else {
      logger.info('loading renderer from file')
      void this.mainWindow.loadFile(path.join(process.env.DIST!, 'index.html')).catch((error) => {
        logger.error('renderer file load failed: error=%s', error instanceof Error ? error.message : String(error))
      })
    }

    logger.info('main window created: webContents=%d', this.mainWindow.webContents.id)
    return this.mainWindow
  }

  hasWindows() {
    return BrowserWindow.getAllWindows().length > 0
  }

  clearMainWindow() {
    this.mainWindow = null
  }

  private registerWindowTelemetry(window: BrowserWindow) {
    const webContentsId = window.webContents.id

    window.webContents.on('did-finish-load', () => {
      logger.info('renderer loaded: webContents=%d', webContentsId)
    })

    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      if (!isMainFrame) {
        return
      }

      logger.error(
        'renderer load failed: webContents=%d errorCode=%d description=%s url=%s',
        webContentsId,
        errorCode,
        errorDescription,
        formatUrlForLog(validatedUrl),
      )
    })

    window.webContents.on('render-process-gone', (_event, details) => {
      logger.error(
        'renderer process gone: webContents=%d reason=%s exitCode=%d',
        webContentsId,
        details.reason,
        details.exitCode,
      )
    })

    window.on('closed', () => {
      logger.info('main window closed: webContents=%d', webContentsId)

      if (this.mainWindow === window) {
        this.clearMainWindow()
      }
    })
  }

  private registerProductionDevToolsGuard(window: BrowserWindow) {
    if (process.env.VITE_DEV_SERVER_URL) {
      return
    }

    window.webContents.on('devtools-opened', () => {
      window.webContents.closeDevTools()
      logger.warn('blocked devtools in production')
    })

    window.webContents.on('before-input-event', (event, input) => {
      const key = input.key.toLowerCase()
      const togglesDevTools = key === 'f12' || ((input.meta || input.control) && input.alt && key === 'i')

      if (togglesDevTools) {
        event.preventDefault()
        logger.warn('blocked devtools shortcut in production: key=%s', input.key)
      }
    })
  }
}
