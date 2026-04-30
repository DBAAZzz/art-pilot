import { BrowserWindow } from 'electron'
import path from 'node:path'
import { getAppIconPath } from './appIcon'

export class WindowManager {
  private mainWindow: BrowserWindow | null = null

  createMainWindow() {
    const icon = getAppIconPath()

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      ...(icon ? { icon } : {}),
      titleBarStyle: 'hiddenInset',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    })

    if (process.env.VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
      // this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.loadFile(path.join(process.env.DIST!, 'index.html'))
    }

    return this.mainWindow
  }

  hasWindows() {
    return BrowserWindow.getAllWindows().length > 0
  }

  clearMainWindow() {
    this.mainWindow = null
  }
}
