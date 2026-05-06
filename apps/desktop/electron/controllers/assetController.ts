import { IPC_CHANNELS } from '@art-pilot/shared'
import type { AssetListQuery } from '@art-pilot/shared'
import { ipcHandler } from './baseController'
import type { Controller } from './baseController'
import type { AssetService } from '../services/assetService'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:asset-controller')

export class AssetController implements Controller {
  constructor(private readonly assetService: AssetService) {}

  register() {
    logger.info('registering asset IPC handlers')
    ipcHandler.handle(IPC_CHANNELS.assets.list, (query?: AssetListQuery) => {
      return this.assetService.listAssets(query)
    })
    ipcHandler.handle(IPC_CHANNELS.assets.getDetail, (imageId: string) => {
      return this.assetService.getAssetDetail(imageId)
    })
    ipcHandler.handle(IPC_CHANNELS.assets.getStats, () => {
      return this.assetService.getStats()
    })
    ipcHandler.handle(IPC_CHANNELS.assets.setFavorite, (imageId: string, favorite: boolean) => {
      return this.assetService.setFavorite(imageId, favorite)
    })
  }
}
