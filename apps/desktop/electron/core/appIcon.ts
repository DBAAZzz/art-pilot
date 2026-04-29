import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export function getAppIconPath() {
  const candidates = [
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, '../../build/icon.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
    path.join(process.resourcesPath, 'build/icon.png'),
    path.join(process.resourcesPath, 'app.asar.unpacked/build/icon.png'),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate))
}
