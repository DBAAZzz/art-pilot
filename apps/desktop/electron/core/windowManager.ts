import { BrowserWindow } from 'electron'
import path from 'node:path'

export class WindowManager {
  private mainWindow: BrowserWindow | null = null

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 670,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    })

    if (process.env.VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
      this.mainWindow.webContents.openDevTools()
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
