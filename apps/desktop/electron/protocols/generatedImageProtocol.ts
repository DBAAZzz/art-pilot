import { app, net, protocol } from 'electron'
import { stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
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
    const parsedUrl = parseGeneratedImageUrl(request.url)

    if (!parsedUrl) {
      logger.warn('rejected generated image request with invalid URL: url=%s', request.url)
      return new Response('Invalid generated image URL', { status: 400 })
    }

    const imagePath = generatedImageRegistry.get(parsedUrl.jobId, parsedUrl.index)

    if (!imagePath) {
      logger.warn(
        'generated image request missed registry: jobId=%s index=%d',
        parsedUrl.jobId,
        parsedUrl.index,
      )
      return new Response('Generated image not found', { status: 404 })
    }

    if (!(await isAllowedGeneratedImagePath(imagePath))) {
      logger.warn(
        'blocked generated image path outside allowed directories: jobId=%s index=%d path=%s',
        parsedUrl.jobId,
        parsedUrl.index,
        imagePath,
      )
      return new Response('Generated image path is not allowed', { status: 403 })
    }

    logger.debug('serving generated image: jobId=%s index=%d path=%s', parsedUrl.jobId, parsedUrl.index, imagePath)
    return net.fetch(pathToFileURL(imagePath).toString())
  })
}

function parseGeneratedImageUrl(url: string) {
  try {
    const parsedUrl = new URL(url)

    if (parsedUrl.protocol !== `${GENERATED_IMAGE_SCHEME}:` || parsedUrl.hostname !== 'generated') {
      return null
    }

    const [encodedJobId, indexValue] = parsedUrl.pathname.split('/').filter(Boolean)
    const index = Number(indexValue)

    if (!encodedJobId || !Number.isInteger(index) || index < 0) {
      return null
    }

    return {
      jobId: decodeURIComponent(encodedJobId),
      index,
    }
  } catch {
    return null
  }
}

async function isAllowedGeneratedImagePath(imagePath: string) {
  const resolvedPath = path.resolve(imagePath)
  const allowedRoots = [
    path.join(os.homedir(), '.codex', 'generated_images'),
    path.join(app.getPath('userData'), 'generated_images'),
  ].map((root) => path.resolve(root))

  if (!allowedRoots.some((root) => isPathInsideRoot(resolvedPath, root))) {
    return false
  }

  try {
    const fileStat = await stat(resolvedPath)

    return fileStat.isFile()
  } catch {
    return false
  }
}

function isPathInsideRoot(filePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, filePath)

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}
