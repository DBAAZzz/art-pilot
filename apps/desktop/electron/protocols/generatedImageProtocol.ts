import { net, protocol } from 'electron'
import { stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { generatedImageRegistry } from './generatedImageRegistry'
import { createLogger } from '../utils/logger'
import type { ImageProtocolUrl } from '../types/generatedImageProtocol'

const logger = createLogger('art-pilot:image-protocol')
const GENERATED_IMAGE_SCHEME = 'artpilot-image'
const IMAGE_PROTOCOL_KINDS = new Set<ImageProtocolUrl['kind']>(['generated', 'reference'])

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
      logger.warn('rejected image request with invalid URL: url=%s', request.url)
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
        imagePath,
      )
      return new Response('Registered image is not a file', { status: 403 })
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
