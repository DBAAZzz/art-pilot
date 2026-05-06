import debug from 'debug'
import { app } from 'electron'
import electronLog from 'electron-log'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { format } from 'node:util'

import { getDesktopEnv } from '../env'

const desktopEnv = getDesktopEnv()
const shouldPersistLogs = app.isPackaged || desktopEnv.NODE_ENV === 'production'

electronLog.transports.file.level = 'info'
electronLog.transports.console.level = shouldPersistLogs ? 'info' : 'debug'

type LogArgs = unknown[]

export function createLogger(namespace: string) {
  const debugLogger = debug(namespace)

  return {
    debug(message: string, ...args: LogArgs) {
      debugLogger(message, ...args)
    },

    error(message: string, ...args: LogArgs) {
      if (shouldPersistLogs) {
        electronLog.error(`[${namespace}] ${format(message, ...args)}`)
        return
      }

      console.error(`[${namespace}] ${format(message, ...args)}`)
    },

    info(message: string, ...args: LogArgs) {
      if (shouldPersistLogs) {
        electronLog.info(`[${namespace}] ${format(message, ...args)}`)
        return
      }

      console.info(`[${namespace}] ${format(message, ...args)}`)
      debugLogger(`INFO: ${message}`, ...args)
    },

    verbose(message: string, ...args: LogArgs) {
      electronLog.verbose(`[${namespace}] ${format(message, ...args)}`)

      if (desktopEnv.DEBUG_VERBOSE) {
        debugLogger(`VERBOSE: ${message}`, ...args)
      }
    },

    warn(message: string, ...args: LogArgs) {
      if (shouldPersistLogs) {
        electronLog.warn(`[${namespace}] ${format(message, ...args)}`)
        return
      }

      console.warn(`[${namespace}] ${format(message, ...args)}`)
      debugLogger(`WARN: ${message}`, ...args)
    },
  }
}

export function formatPathForLog(filePath: string) {
  const basename = path.basename(filePath) || 'unknown'

  return `${basename}#${hashForLog(filePath)}`
}

export function formatUrlForLog(value: string) {
  try {
    const url = new URL(value)

    if (url.protocol === 'file:') {
      return `file://${formatPathForLog(decodeURIComponent(url.pathname))}`
    }

    const redactedSearch = url.search ? '?<redacted>' : ''

    return `${url.origin}${url.pathname}${redactedSearch}#${hashForLog(value)}`
  } catch {
    return `invalid-url#${hashForLog(value)}`
  }
}

function hashForLog(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 10)
}
