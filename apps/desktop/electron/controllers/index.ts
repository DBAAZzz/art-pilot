import { app } from 'electron'
import { FileController } from './fileController'
import { WindowController } from './windowController'
import { FileService } from '../services/fileService'

export function registerControllers() {
  const fileService = new FileService(app.getAppPath())

  const controllers = [new FileController(fileService), new WindowController()]

  controllers.forEach((controller) => controller.register())
}
