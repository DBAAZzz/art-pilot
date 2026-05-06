import { CodexController } from './codexController'
import { ImageHistoryController } from './imageHistoryController'
import { ImageGenerationController } from './imageGenerationController'
import { PromptController } from './promptController'
import { SettingsController } from './settingsController'
import { SystemController } from './systemController'
import { WindowController } from './windowController'
import { CodexImageProvider } from '../providers/codexImageProvider'
import { CodexService } from '../services/codexService'
import { CodexCleanupService } from '../services/codexCleanupService'
import { DatabaseService } from '../services/databaseService'
import { ImageHistoryService } from '../services/imageHistoryService'
import { ImageGenerationService } from '../services/imageGenerationService'
import { ImageLibraryService } from '../services/imageLibraryService'
import { PromptImportService } from '../services/promptImportService'
import { PromptService } from '../services/promptService'
import { SettingsService } from '../services/settingsService'

export function registerControllers() {
  const databaseService = new DatabaseService()
  const settingsService = new SettingsService(databaseService)
  const imageLibraryService = new ImageLibraryService(settingsService)
  const imageHistoryService = new ImageHistoryService(databaseService)
  const codexCleanupService = new CodexCleanupService(databaseService, settingsService)
  const codexImageProvider = new CodexImageProvider()
  const codexService = new CodexService()
  const promptImportService = new PromptImportService()
  const promptService = new PromptService(databaseService)
  const imageGenerationService = new ImageGenerationService(
    codexImageProvider,
    imageLibraryService,
    imageHistoryService,
    codexCleanupService,
  )

  const controllers = [
    new CodexController(codexService),
    new ImageGenerationController(imageGenerationService),
    new SettingsController(settingsService),
    new ImageHistoryController(imageHistoryService, settingsService),
    new PromptController(promptImportService, promptService),
    new SystemController(),
    new WindowController(),
  ]

  controllers.forEach((controller) => controller.register())
}
