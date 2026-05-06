import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { SavePromptRequest } from '@art-pilot/shared'
import type { Controller } from './baseController'
import type { PromptImportService } from '../services/promptImportService'
import type { PromptService } from '../services/promptService'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:prompt-controller')

export class PromptController implements Controller {
  constructor(
    private readonly promptImportService: PromptImportService,
    private readonly promptService: PromptService,
  ) {}

  register() {
    logger.info('registering prompt IPC handlers')
    ipcMain.handle(IPC_CHANNELS.prompt.previewImport, (_event, url: string) => {
      return this.promptImportService.previewImport(url)
    })

    ipcMain.handle(IPC_CHANNELS.prompt.save, (_event, request: SavePromptRequest) => {
      return this.promptService.savePrompt(request)
    })

    ipcMain.handle(IPC_CHANNELS.prompt.list, () => {
      return this.promptService.listPrompts()
    })
  }
}
