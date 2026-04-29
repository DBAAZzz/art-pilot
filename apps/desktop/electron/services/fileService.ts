import { readFile } from 'node:fs/promises'
import path from 'node:path'

export class FileService {
  constructor(private readonly appPath: string) {}

  readOneTextFile() {
    return readFile(path.join(this.appPath, '1.txt'), 'utf-8')
  }
}

