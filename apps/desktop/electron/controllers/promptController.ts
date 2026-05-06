import { IPC_CHANNELS } from '@art-pilot/shared'
import type { SavePromptRequest } from '@art-pilot/shared'
import { ipcHandler } from './baseController'
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
    ipcHandler.handle(IPC_CHANNELS.prompt.previewImport, (url: string) => {
      return this.promptImportService.previewImport(url)
    })

    ipcHandler.handle(IPC_CHANNELS.prompt.save, (request: SavePromptRequest) => {
      return this.promptService.savePrompt(request)
    })

    ipcHandler.handle(IPC_CHANNELS.prompt.list, () => {
      return this.promptService.listPrompts()
    })
  }
}
