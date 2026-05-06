import { AsyncLocalStorage } from 'node:async_hooks'
import { ipcMain } from 'electron'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:ipc-handler')
const ipcContextStorage = new AsyncLocalStorage<IpcContext>()

export interface Controller {
  register(): void
}

export type IpcContext = {
  event: IpcMainInvokeEvent
  sender: WebContents
}

type IpcMethodHandler<TArgs extends unknown[], TResult> = (...args: TArgs) => TResult | Promise<TResult>

class IpcHandler {
  private readonly registeredChannels = new Set<string>()

  handle<TArgs extends unknown[], TResult>(
    channel: string,
    handler: IpcMethodHandler<TArgs, TResult>,
  ) {
    if (this.registeredChannels.has(channel)) {
      logger.warn('ignored duplicate IPC handler registration: channel=%s', channel)
      return
    }

    this.registeredChannels.add(channel)
    ipcMain.handle(channel, async (event, ...args) => {
      const startedAt = performance.now()
      const context: IpcContext = {
        event,
        sender: event.sender,
      }

      return ipcContextStorage.run(context, async () => {
        try {
          const result = await handler(...args as TArgs)

          logger.info(
            'IPC handler completed: channel=%s sender=%d durationMs=%d',
            channel,
            event.sender.id,
            getElapsedMs(startedAt),
          )

          return result
        } catch (error) {
          logger.error(
            'IPC handler failed: channel=%s sender=%d durationMs=%d error=%s',
            channel,
            event.sender.id,
            getElapsedMs(startedAt),
            error instanceof Error ? error.message : String(error),
          )
          throw error
        }
      })
    })
  }
}

function getElapsedMs(startedAt: number) {
  return Math.round(performance.now() - startedAt)
}

export function getIpcContext() {
  const context = ipcContextStorage.getStore()

  if (!context) {
    throw new Error('IPC context is only available during an IPC handler call')
  }

  return context
}

export const ipcHandler = new IpcHandler()
