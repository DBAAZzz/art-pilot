import { app } from 'electron'
import { FileController } from './fileController'
import { FileService } from '../services/fileService'

export function registerControllers() {
  const fileService = new FileService(app.getAppPath())

  const controllers = [new FileController(fileService)]

  controllers.forEach((controller) => controller.register())
}

