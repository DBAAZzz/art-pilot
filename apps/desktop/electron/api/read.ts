import { FileService } from '../services/fileService'

export function readOneTextFile(baseDir: string) {
  return new FileService(baseDir).readOneTextFile()
}
