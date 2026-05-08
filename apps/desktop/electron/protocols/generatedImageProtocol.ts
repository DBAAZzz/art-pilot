import { app, nativeImage, net, protocol } from 'electron'
import { createHash } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { generatedImageRegistry } from './generatedImageRegistry'
import { createLogger, formatPathForLog, formatUrlForLog } from '../utils/logger'
import type { ImageProtocolUrl } from '../types/generatedImageProtocol'

const logger = createLogger('art-pilot:image-protocol')
const GENERATED_IMAGE_SCHEME = 'artpilot-image'
const IMAGE_PROTOCOL_KINDS = new Set<ImageProtocolUrl['kind']>(['generated', 'reference', 'asset-original', 'asset-thumbnail'])
const THUMBNAIL_SIZE = 320
const THUMBNAIL_JPEG_QUALITY = 80
const THUMBNAIL_CACHE_VERSION = 1
const THUMBNAIL_CONTENT_TYPE = 'image/jpeg'
const THUMBNAIL_WARMUP_BATCH_SIZE = 60

type ThumbnailWarmupItem = {
  imageId: string
  imagePath: string
}

const pendingThumbnailWarmupKeys = new Set<string>()
const thumbnailWarmupQueue: ThumbnailWarmupItem[] = []
let isThumbnailWarmupRunning = false

export function registerGeneratedImageProtocolScheme() {
  logger.info('registering generated image protocol scheme: scheme=%s', GENERATED_IMAGE_SCHEME)
  protocol.registerSchemesAsPrivileged([
    {
      scheme: GENERATED_IMAGE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
      },
    },
  ])
}

export function registerGeneratedImageProtocolHandler() {
  logger.info('registering generated image protocol handler: scheme=%s', GENERATED_IMAGE_SCHEME)
  protocol.handle(GENERATED_IMAGE_SCHEME, async (request) => {
    const parsedUrl = parseImageProtocolUrl(request.url)

    if (!parsedUrl) {
      logger.warn('rejected image request with invalid URL: url=%s', formatUrlForLog(request.url))
      return new Response('Invalid image URL', { status: 400 })
    }

    const imagePath = getRegisteredImagePath(parsedUrl)

    if (!imagePath) {
      logger.warn(
        'image request missed registry: kind=%s jobId=%s index=%d',
        parsedUrl.kind,
        parsedUrl.jobId,
        parsedUrl.index,
      )
      return new Response('Image not found', { status: 404 })
    }

    if (!(await isRegisteredFile(imagePath))) {
      logger.warn(
        'blocked registered image path that is not a file: kind=%s jobId=%s index=%d path=%s',
        parsedUrl.kind,
        parsedUrl.jobId,
        parsedUrl.index,
        formatPathForLog(imagePath),
      )
      return new Response('Registered image is not a file', { status: 403 })
    }

    if (parsedUrl.kind === 'asset-thumbnail') {
      logger.debug('serving thumbnail image: kind=%s path=%s', parsedUrl.kind, imagePath)
      return createThumbnailResponse(parsedUrl.imageId, imagePath)
    }

    logger.debug('serving image: kind=%s path=%s', parsedUrl.kind, imagePath)
    return net.fetch(pathToFileURL(imagePath).toString())
  })
}

function getRegisteredImagePath(parsedUrl: ImageProtocolUrl) {
  if (parsedUrl.kind === 'generated') {
    return generatedImageRegistry.get(parsedUrl.jobId, parsedUrl.index)
  }

  if (parsedUrl.kind === 'reference') {
    return generatedImageRegistry.getReference(parsedUrl.jobId, parsedUrl.index)
  }

  if (parsedUrl.kind === 'asset-original' || parsedUrl.kind === 'asset-thumbnail') {
    return generatedImageRegistry.getAsset(parsedUrl.imageId)
  }

  return undefined
}

function parseImageProtocolUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    const kind = parseImageProtocolKind(parsedUrl)

    if (!kind) {
      return null
    }

    const pathParts = parsedUrl.pathname.split('/').filter(Boolean)

    if (kind === 'asset-original' || kind === 'asset-thumbnail') {
      const imageId = pathParts[0]

      return typeof imageId === 'string' && imageId.length > 0
        ? {
            kind,
            imageId: decodeURIComponent(imageId),
          }
        : null
    }

    const jobId = parseImageProtocolJobId(pathParts[0])
    const index = parseImageProtocolIndex(pathParts[1])

    if (!jobId || index === null) {
      return null
    }

    return {
      kind,
      jobId,
      index,
    }
  } catch {
    return null
  }
}

async function createThumbnailResponse(imageId: string, imagePath: string) {
  const cachePath = await getThumbnailCachePath(imageId, imagePath)

  if (cachePath) {
    const cachedThumbnail = await readThumbnailCache(cachePath)

    if (cachedThumbnail) {
      return createImageResponse(cachedThumbnail, THUMBNAIL_CONTENT_TYPE)
    }
  }

  const jpegBuffer = createThumbnailBuffer(imagePath)

  if (!jpegBuffer) {
    return new Response('Image not found', { status: 404 })
  }

  if (cachePath) {
    void writeThumbnailCache(cachePath, jpegBuffer)
  }

  return createImageResponse(jpegBuffer, THUMBNAIL_CONTENT_TYPE)
}

export function warmAssetThumbnailCache(items: ThumbnailWarmupItem[]) {
  for (const item of items.slice(0, THUMBNAIL_WARMUP_BATCH_SIZE)) {
    const key = createThumbnailWarmupKey(item)

    if (pendingThumbnailWarmupKeys.has(key)) {
      continue
    }

    pendingThumbnailWarmupKeys.add(key)
    thumbnailWarmupQueue.push(item)
  }

  if (!isThumbnailWarmupRunning && thumbnailWarmupQueue.length > 0) {
    isThumbnailWarmupRunning = true
    void runThumbnailWarmupQueue()
  }
}

async function runThumbnailWarmupQueue() {
  while (thumbnailWarmupQueue.length > 0) {
    const item = thumbnailWarmupQueue.shift()

    if (!item) {
      continue
    }

    const key = createThumbnailWarmupKey(item)

    try {
      await yieldToEventLoop()
      await ensureThumbnailCached(item)
    } finally {
      pendingThumbnailWarmupKeys.delete(key)
    }
  }

  isThumbnailWarmupRunning = false

  if (thumbnailWarmupQueue.length > 0) {
    isThumbnailWarmupRunning = true
    void runThumbnailWarmupQueue()
  }
}

async function ensureThumbnailCached(item: ThumbnailWarmupItem) {
  const cachePath = await getThumbnailCachePath(item.imageId, item.imagePath)

  if (!cachePath || await thumbnailCacheExists(cachePath)) {
    return
  }

  const jpegBuffer = createThumbnailBuffer(item.imagePath)

  if (!jpegBuffer) {
    return
  }

  await writeThumbnailCache(cachePath, jpegBuffer)
}

function createThumbnailBuffer(imagePath: string) {
  const image = nativeImage.createFromPath(imagePath)

  if (image.isEmpty()) {
    return null
  }

  const thumbnail = image.resize({
    ...getThumbnailResizeOptions(image.getSize()),
    quality: 'good',
  })

  return thumbnail.toJPEG(THUMBNAIL_JPEG_QUALITY)
}

function createImageResponse(buffer: Buffer, contentType: string) {
  const bytes = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(bytes).set(buffer)

  return new Response(bytes, {
    headers: {
      'cache-control': 'public, max-age=31536000, immutable',
      'content-type': contentType,
    },
  })
}

function getThumbnailResizeOptions(size: Electron.Size) {
  if (size.width >= size.height) {
    return { width: THUMBNAIL_SIZE }
  }

  return { height: THUMBNAIL_SIZE }
}

async function getThumbnailCachePath(imageId: string, imagePath: string) {
  try {
    const fileStat = await stat(imagePath)

    if (!fileStat.isFile()) {
      return null
    }

    const cacheKey = createThumbnailCacheKey({
      imageId,
      mtimeMs: fileStat.mtimeMs,
      sourcePath: imagePath,
    })

    return path.join(app.getPath('userData'), 'thumbnails', `${cacheKey}.jpg`)
  } catch (error) {
    logger.warn(
      'failed to prepare thumbnail cache key: imageId=%s path=%s error=%s',
      imageId,
      formatPathForLog(imagePath),
      error instanceof Error ? error.message : String(error),
    )
    return null
  }
}

function createThumbnailCacheKey(input: { imageId: string; mtimeMs: number; sourcePath: string }) {
  return createHash('sha256')
    .update(JSON.stringify({
      imageId: input.imageId,
      mtimeMs: input.mtimeMs,
      quality: THUMBNAIL_JPEG_QUALITY,
      size: THUMBNAIL_SIZE,
      sourcePath: input.sourcePath,
      version: THUMBNAIL_CACHE_VERSION,
    }))
    .digest('hex')
}

async function readThumbnailCache(cachePath: string) {
  try {
    return await readFile(cachePath)
  } catch {
    return null
  }
}

async function thumbnailCacheExists(cachePath: string) {
  try {
    const cacheStat = await stat(cachePath)

    return cacheStat.isFile()
  } catch {
    return false
  }
}

async function writeThumbnailCache(cachePath: string, buffer: Buffer) {
  try {
    await mkdir(path.dirname(cachePath), { recursive: true })
    await writeFile(cachePath, buffer)
  } catch (error) {
    logger.warn(
      'failed to write thumbnail cache: path=%s error=%s',
      formatPathForLog(cachePath),
      error instanceof Error ? error.message : String(error),
    )
  }
}

function createThumbnailWarmupKey(item: ThumbnailWarmupItem) {
  return `${item.imageId}:${item.imagePath}`
}

function yieldToEventLoop() {
  return new Promise<void>((resolve) => {
    setImmediate(resolve)
  })
}

function parseImageProtocolKind(parsedUrl: URL): ImageProtocolUrl['kind'] | null {
  if (parsedUrl.protocol !== `${GENERATED_IMAGE_SCHEME}:`) {
    return null
  }

  return IMAGE_PROTOCOL_KINDS.has(parsedUrl.hostname as ImageProtocolUrl['kind'])
    ? parsedUrl.hostname as ImageProtocolUrl['kind']
    : null
}

function parseImageProtocolJobId(encodedJobId: string | undefined) {
  return encodedJobId ? decodeURIComponent(encodedJobId) : null
}

function parseImageProtocolIndex(indexValue: string | undefined) {
  const index = Number(indexValue)

  return Number.isInteger(index) && index >= 0 ? index : null
}

async function isRegisteredFile(imagePath: string) {
  try {
    const fileStat = await stat(imagePath)

    return fileStat.isFile()
  } catch {
    return false
  }
}
