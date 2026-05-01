import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { ImageGenerationRequest } from '@art-pilot/shared'
import type { Controller } from './baseController'
import type { ImageGenerationService } from '../services/imageGenerationService'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image-controller')

export class ImageGenerationController implements Controller {
  constructor(private readonly imageGenerationService: ImageGenerationService) {}

  register() {
    logger.info('registering image generation IPC handlers')

    ipcMain.handle(IPC_CHANNELS.image.generateStart, (event, request: ImageGenerationRequest) => {
      // 新的 streaming 调用链：这里只启动任务，图片进度由 service 通过 generationEvent 推送。
      logger.info(
        'streaming image generate requested: sender=%d promptLength=%d count=%s size=%s references=%d',
        event.sender.id,
        request.prompt?.length ?? 0,
        String(request.count ?? 'default'),
        request.size ?? 'default',
        request.references?.length ?? 0,
      )
      return this.imageGenerationService.startImageGeneration(event.sender, request)
    })
    ipcMain.handle(IPC_CHANNELS.image.cancel, (event, jobId: string) => {
      // 取消按 Art Pilot jobId 定位 active job，不直接暴露 Codex thread/process 给 renderer。
      logger.info('image generation cancel requested: sender=%d jobId=%s', event.sender.id, jobId)
      return this.imageGenerationService.cancelImageGeneration(jobId)
    })
  }
}
