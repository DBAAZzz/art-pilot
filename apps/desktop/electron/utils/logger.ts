import debug from 'debug'
import electronLog from 'electron-log'
import { format } from 'node:util'

import { getDesktopEnv } from '../env'

const desktopEnv = getDesktopEnv()

electronLog.transports.file.level = 'info'
electronLog.transports.console.level = desktopEnv.NODE_ENV === 'development' ? 'debug' : 'info'

type LogArgs = unknown[]

export function createLogger(namespace: string) {
  const debugLogger = debug(namespace)

  return {
    debug(message: string, ...args: LogArgs) {
      debugLogger(message, ...args)
    },

    error(message: string, ...args: LogArgs) {
      if (desktopEnv.NODE_ENV === 'production') {
        electronLog.error(`[${namespace}] ${format(message, ...args)}`)
        return
      }

      console.error(`[${namespace}] ${format(message, ...args)}`)
    },

    info(message: string, ...args: LogArgs) {
      if (desktopEnv.NODE_ENV === 'production') {
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
      if (desktopEnv.NODE_ENV === 'production') {
        electronLog.warn(`[${namespace}] ${format(message, ...args)}`)
        return
      }

      console.warn(`[${namespace}] ${format(message, ...args)}`)
      debugLogger(`WARN: ${message}`, ...args)
    },
  }
}
