import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export function getAppIconPath() {
  const iconFileName = app.isPackaged ? 'icon.png' : 'icon-dev.png'
  const candidates = getIconCandidates(iconFileName)

  if (!app.isPackaged) {
    candidates.push(...getIconCandidates('icon.png'))
  }

  return candidates.find((candidate) => fs.existsSync(candidate))
}

function getIconCandidates(iconFileName: string) {
  return [
    path.join(__dirname, `../build/${iconFileName}`),
    path.join(__dirname, `../../build/${iconFileName}`),
    path.join(app.getAppPath(), `build/${iconFileName}`),
    path.join(process.resourcesPath, `build/${iconFileName}`),
    path.join(process.resourcesPath, `app.asar.unpacked/build/${iconFileName}`),
  ]
}
