import { net, protocol } from 'electron'
import { stat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { generatedImageRegistry } from './generatedImageRegistry'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:image-protocol')
const GENERATED_IMAGE_SCHEME = 'artpilot-image'

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
        'jobId' in parsedUrl ? parsedUrl.jobId : parsedUrl.referenceId,
        'index' in parsedUrl ? parsedUrl.index : 0,
      )
      return new Response('Image not found', { status: 404 })
    }

    if (!(await isAllowedGeneratedImagePath(imagePath))) {
      logger.warn(
        'blocked image path outside allowed directories: kind=%s jobId=%s index=%d path=%s',
        parsedUrl.kind,
        'jobId' in parsedUrl ? parsedUrl.jobId : parsedUrl.referenceId,
        'index' in parsedUrl ? parsedUrl.index : 0,
        imagePath,
      )
      return new Response('Image path is not allowed', { status: 403 })
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

  return generatedImageRegistry.getDraftReference(parsedUrl.referenceId)
}

function parseImageProtocolUrl(url: string) {
  try {
    const parsedUrl = new URL(url)

    if (
      parsedUrl.protocol !== `${GENERATED_IMAGE_SCHEME}:`
      || (
        parsedUrl.hostname !== 'generated'
        && parsedUrl.hostname !== 'reference'
        && parsedUrl.hostname !== 'reference-draft'
      )
    ) {
      return null
    }

    if (parsedUrl.hostname === 'reference-draft') {
      const [encodedReferenceId] = parsedUrl.pathname.split('/').filter(Boolean)

      if (!encodedReferenceId) {
        return null
      }

      return {
        kind: 'reference-draft' as const,
        referenceId: decodeURIComponent(encodedReferenceId),
      }
    }

    const [encodedJobId, indexValue] = parsedUrl.pathname.split('/').filter(Boolean)
    const index = Number(indexValue)

    if (!encodedJobId || !Number.isInteger(index) || index < 0) {
      return null
    }

    return {
      kind: parsedUrl.hostname as 'generated' | 'reference',
      jobId: decodeURIComponent(encodedJobId),
      index,
    }
  } catch {
    return null
  }
}

type ImageProtocolUrl =
  | {
      kind: 'generated'
      jobId: string
      index: number
    }
  | {
      kind: 'reference'
      jobId: string
      index: number
    }
  | {
      kind: 'reference-draft'
      referenceId: string
    }

async function isAllowedGeneratedImagePath(imagePath: string) {
  try {
    const fileStat = await stat(imagePath)

    return fileStat.isFile()
  } catch {
    return false
  }
}
