import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { Controller } from './baseController'
import type { FileService } from '../services/fileService'

export class FileController implements Controller {
  constructor(private readonly fileService: FileService) {}

  register() {
    ipcMain.handle(IPC_CHANNELS.file.readOneTextFile, () => {
      return this.fileService.readOneTextFile()
    })
  }
}
