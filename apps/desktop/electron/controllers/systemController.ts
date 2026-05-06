import { ipcMain, shell } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { Controller } from './baseController'

export class SystemController implements Controller {
  register(): void {
    ipcMain.handle(IPC_CHANNELS.system.openExternalUrl, async (_event, url: string) => {
      const externalUrl = normalizeExternalUrl(url)
      await shell.openExternal(externalUrl)
    })
  }
}

function normalizeExternalUrl(value: unknown) {
  if (typeof value !== 'string') {
    throw new Error('外部链接格式不正确')
  }

  const text = value.trim()

  try {
    const url = new URL(text)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('外部链接只支持 HTTP 或 HTTPS')
    }

    return url.toString()
  } catch (error) {
    if (error instanceof Error && error.message === '外部链接只支持 HTTP 或 HTTPS') {
      throw error
    }

    throw new Error('外部链接格式不正确')
  }
}
