import { CodexController } from './codexController'
import { ImageGenerationController } from './imageGenerationController'
import { WindowController } from './windowController'
import { CodexImageProvider } from '../providers/codexImageProvider'
import { CodexService } from '../services/codexService'
import { ImageGenerationService } from '../services/imageGenerationService'

export function registerControllers() {
  const codexImageProvider = new CodexImageProvider()
  const codexService = new CodexService()
  const imageGenerationService = new ImageGenerationService(codexImageProvider)

  const controllers = [
    new CodexController(codexService),
    new ImageGenerationController(imageGenerationService),
    new WindowController(),
  ]

  controllers.forEach((controller) => controller.register())
}
