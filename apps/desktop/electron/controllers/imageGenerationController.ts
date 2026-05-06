import { app, clipboard, dialog, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IPC_CHANNELS, MAX_IMAGE_REFERENCE_FILE_SIZE } from '@art-pilot/shared'
import type { ImageGenerationRequest, ImageReference } from '@art-pilot/shared'
import type { Controller } from './baseController'
import type { ImageGenerationService } from '../services/imageGenerationService'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image-controller')
const IMAGE_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}
const CLIPBOARD_REFERENCE_FOLDER_NAME = 'clipboard-reference-images'

export class ImageGenerationController implements Controller {
  constructor(private readonly imageGenerationService: ImageGenerationService) {}

  register() {
    logger.info('registering image generation IPC handlers')

    ipcMain.handle(IPC_CHANNELS.image.generateStart, (event, request: ImageGenerationRequest) => {
      // 新的 streaming 调用链：这里只启动任务，图片进度由 service 通过 generationEvent 推送。
      logger.info(
        'streaming image generate requested: sender=%d promptLength=%d count=%s aspectRatio=%s size=%s references=%d',
        event.sender.id,
        request.prompt?.length ?? 0,
        String(request.count ?? 'default'),
        request.aspectRatio ?? 'default',
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
    ipcMain.handle(IPC_CHANNELS.image.selectReferences, async (event): Promise<ImageReference[]> => {
      logger.info('image reference selection requested: sender=%d', event.sender.id)
      const result = await dialog.showOpenDialog({
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'apng'],
          },
        ],
        properties: ['openFile', 'multiSelections'],
      })

      if (result.canceled || result.filePaths.length === 0) {
        return []
      }

      return Promise.all(result.filePaths.map((filePath) => createImageReference(filePath)))
    })
    ipcMain.handle(IPC_CHANNELS.image.pasteReferences, async (event): Promise<ImageReference[]> => {
      logger.info('image reference paste requested: sender=%d', event.sender.id)
      const clipboardImage = clipboard.readImage()

      if (!clipboardImage.isEmpty()) {
        const imageBuffer = clipboardImage.toPNG()

        if (imageBuffer.byteLength > MAX_IMAGE_REFERENCE_FILE_SIZE) {
          throw new Error(`参考图文件不能超过 ${Math.trunc(MAX_IMAGE_REFERENCE_FILE_SIZE / 1024 / 1024)}MB`)
        }

        const referenceId = randomUUID()
        const fileName = `clipboard-${Date.now()}-${referenceId}.png`
        const referenceFolderPath = path.join(app.getPath('userData'), CLIPBOARD_REFERENCE_FOLDER_NAME)
        const filePath = path.join(referenceFolderPath, fileName)

        await mkdir(referenceFolderPath, { recursive: true })
        await writeFile(filePath, imageBuffer)

        return [
          {
            id: referenceId,
            kind: 'local-file',
            path: filePath,
            name: fileName,
            mimeType: 'image/png',
            imageUrl: createImageDataUrl(imageBuffer, 'image/png'),
          },
        ]
      }

      const fileReferences = await readClipboardImageFileReferences()

      if (fileReferences.length > 0) {
        return fileReferences
      }

      logger.info('image reference paste ignored because clipboard has no image or image file: sender=%d', event.sender.id)
      return []
    })
  }
}

async function readClipboardImageFileReferences() {
  const filePaths = readClipboardFilePaths().filter(isAllowedImagePath)
  const references: ImageReference[] = []

  for (const filePath of filePaths) {
    try {
      references.push(await createImageReference(filePath))
    } catch (error) {
      logger.warn(
        'skipped clipboard image file reference: path=%s error=%s',
        filePath,
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  return references
}

function readClipboardFilePaths() {
  const formats = clipboard.availableFormats()
  const filePathCandidates = new Set<string>()
  const preferredFormats = [
    'public.file-url',
    'text/uri-list',
    'NSFilenamesPboardType',
    'FileNameW',
    'FileName',
    'x-special/gnome-copied-files',
  ]

  for (const format of preferredFormats) {
    if (!formats.includes(format)) {
      continue
    }

    for (const candidate of parseClipboardPathValue(clipboard.read(format))) {
      filePathCandidates.add(candidate)
    }
  }

  return [...filePathCandidates]
}

function parseClipboardPathValue(value: string) {
  return value
    .split(/\r?\n|\0/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== 'copy' && line !== 'cut')
    .map(decodeClipboardPath)
    .filter((filePath): filePath is string => Boolean(filePath))
}

function decodeClipboardPath(value: string) {
  if (value.startsWith('file://')) {
    try {
      return fileURLToPath(value)
    } catch {
      return null
    }
  }

  return path.isAbsolute(value) ? value : null
}

function isAllowedImagePath(filePath: string) {
  return Boolean(IMAGE_MIME_TYPE_BY_EXTENSION[path.extname(filePath).toLowerCase()])
}

async function createImageReference(filePath: string): Promise<ImageReference> {
  const extension = path.extname(filePath).toLowerCase()
  const mimeType = IMAGE_MIME_TYPE_BY_EXTENSION[extension]
  const imageBuffer = await readImagePreviewBuffer(filePath)

  return {
    id: randomUUID(),
    kind: 'local-file',
    path: filePath,
    name: path.basename(filePath),
    mimeType,
    imageUrl: createImageDataUrl(imageBuffer, mimeType),
  }
}

async function readImagePreviewBuffer(filePath: string) {
  const fileStat = await stat(filePath)

  if (fileStat.size > MAX_IMAGE_REFERENCE_FILE_SIZE) {
    throw new Error(`参考图文件不能超过 ${Math.trunc(MAX_IMAGE_REFERENCE_FILE_SIZE / 1024 / 1024)}MB`)
  }

  return readFile(filePath)
}

function createImageDataUrl(imageBuffer: Buffer, mimeType = 'image/png') {
  return `data:${mimeType};base64,${imageBuffer.toString('base64')}`
}
