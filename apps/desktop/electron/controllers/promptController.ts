import { IPC_CHANNELS } from '@art-pilot/shared'
import type { PromptTemplateDraft, ResolvePromptTemplateRequest, SavePromptRequest, UpdatePromptTemplateRequest } from '@art-pilot/shared'
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
    ipcHandler.handle(IPC_CHANNELS.prompt.fillFromUrl, (url: string) => {
      return this.promptImportService.fillFromUrl(url)
    })

    ipcHandler.handle(IPC_CHANNELS.prompt.saveTemplate, (request: PromptTemplateDraft) => {
      return this.promptService.savePromptTemplate(request)
    })

    ipcHandler.handle(IPC_CHANNELS.prompt.updateTemplate, (request: UpdatePromptTemplateRequest) => {
      return this.promptService.updatePromptTemplate(request)
    })

    ipcHandler.handle(IPC_CHANNELS.prompt.listTemplates, () => {
      return this.promptService.listPromptTemplates()
    })

    ipcHandler.handle(IPC_CHANNELS.prompt.getTemplate, (templateId: string) => {
      return this.promptService.getPromptTemplateById(templateId)
    })

    ipcHandler.handle(IPC_CHANNELS.prompt.resolveTemplate, (request: ResolvePromptTemplateRequest) => {
      return this.promptService.resolvePromptTemplate(request)
    })

    ipcHandler.handle(IPC_CHANNELS.prompt.addAssetPreviewImage, (templateId: string, imageId: string) => {
      return this.promptService.addAssetPreviewImage(templateId, imageId)
    })

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
