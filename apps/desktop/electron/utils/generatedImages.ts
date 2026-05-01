import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { createLogger } from './logger'

const logger = createLogger('art-pilot:generated-images')

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif'])
const CODEX_SESSION_FILE_EXTENSION = '.jsonl'
const CODEX_SESSION_EVENT_TYPES = {
  sessionMeta: 'session_meta',
} as const
const CODEX_SESSION_PAYLOAD_TYPES = {
  imageGenerationEnd: 'image_generation_end',
} as const
const CODEX_SESSION_LARGE_FIELDS = {
  result: 'result',
} as const

export async function findCodexGeneratedImagesFromSessions(options: {
  sinceMs: number
  threadId?: string
  sessionPaths?: string[]
}): Promise<{ imagePaths: string[]; sessionPaths: string[] }> {
  const { sinceMs, threadId, sessionPaths: knownSessionPaths = [] } = options

  if (knownSessionPaths.length > 0) {
    // 找到 thread 对应的 session 文件后，后续轮询只需要反复读取这些 JSONL，
    // 不再递归扫描 ~/.codex/sessions，避免大量重复日志和不必要的目录 IO。
    const imagePaths = await extractImagesFromSessions(knownSessionPaths, threadId)

    if (imagePaths.length > 0 || !threadId) {
      return { imagePaths, sessionPaths: knownSessionPaths }
    }

    const generatedImagesDir = path.join(homedir(), '.codex', 'generated_images', threadId)
    const dirImages = await scanImageDirectory(generatedImagesDir, sinceMs)
    return { imagePaths: [...new Set(dirImages)], sessionPaths: knownSessionPaths }
  }

  if (!threadId) {
    // stdout 里的 thread.started 可能因为 Codex 输出格式变化或解析失败而缺失。
    // 这种情况下退回到 startedAt 之后更新过的 session 文件，牺牲精确性换取不丢结果。
    const sessionPaths = await findUpdatedCodexSessionFiles(sinceMs)
    const imagePaths = await extractImagesFromSessions(sessionPaths)
    return { imagePaths, sessionPaths }
  }

  const sessionPaths = await globCodexSessionFilesByThreadId(threadId)

  if (sessionPaths.length > 0) {
    logger.info('found session files by threadId: threadId=%s count=%d', threadId, sessionPaths.length)
    const imagePaths = await extractImagesFromSessions(sessionPaths, threadId)

    if (imagePaths.length > 0) {
      return { imagePaths, sessionPaths }
    }
  }

  const generatedImagesDir = path.join(homedir(), '.codex', 'generated_images', threadId)
  const dirImages = await scanImageDirectory(generatedImagesDir, sinceMs)

  if (dirImages.length > 0) {
    logger.info('found images by scanning generated_images directory: threadId=%s count=%d', threadId, dirImages.length)
  }

  return { imagePaths: [...new Set(dirImages)], sessionPaths }
}

async function findFilesChangedSince(directoryPath: string, sinceMs: number, predicate: (filePath: string) => boolean): Promise<string[]> {
  let entries

  try {
    entries = await readdir(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name)

      if (entry.isDirectory()) {
        return findFilesChangedSince(entryPath, sinceMs, predicate)
      }

      if (!entry.isFile() || !predicate(entryPath)) {
        return []
      }

      const fileStat = await stat(entryPath)
      return fileStat.mtimeMs >= sinceMs ? [entryPath] : []
    }),
  )

  return files.flat()
}

export function findUpdatedCodexSessionFiles(sinceMs: number) {
  const sessionsPath = path.join(homedir(), '.codex', 'sessions')

  return findFilesChangedSince(sessionsPath, sinceMs, (filePath) => filePath.endsWith(CODEX_SESSION_FILE_EXTENSION))
}

async function globCodexSessionFilesByThreadId(threadId: string): Promise<string[]> {
  const sessionsRoot = path.join(homedir(), '.codex', 'sessions')
  const results: string[] = []

  async function walk(dir: string) {
    let entries

    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.isFile() && entry.name.includes(threadId) && entry.name.endsWith(CODEX_SESSION_FILE_EXTENSION)) {
        results.push(fullPath)
      }
    }
  }

  await walk(sessionsRoot)
  return results
}

async function extractImagesFromSessions(sessionPaths: string[], fallbackSessionId?: string): Promise<string[]> {
  const imagePaths = await Promise.all(
    sessionPaths.map((sessionPath) => extractGeneratedImagesFromSession(sessionPath, fallbackSessionId)),
  )
  return [...new Set(imagePaths.flat())]
}

async function scanImageDirectory(dirPath: string, sinceMs: number): Promise<string[]> {
  let entries

  try {
    entries = await readdir(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        return scanImageDirectory(entryPath, sinceMs)
      }

      if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        return []
      }

      const fileStat = await stat(entryPath)
      return fileStat.mtimeMs >= sinceMs ? [entryPath] : []
    }),
  )

  return files.flat()
}

async function extractGeneratedImagesFromSession(sessionPath: string, fallbackSessionId?: string) {
  try {
    const content = await readFile(sessionPath, 'utf8')
    const imagePaths: string[] = []
    let sessionId: string | undefined

    for (const line of content.split(/\r?\n/)) {
      if (!line.includes(CODEX_SESSION_EVENT_TYPES.sessionMeta) && !line.includes(CODEX_SESSION_PAYLOAD_TYPES.imageGenerationEnd)) {
        continue
      }

      const event = JSON.parse(line, (key, value) => (key === CODEX_SESSION_LARGE_FIELDS.result ? undefined : value)) as {
        type?: string
        payload?: {
          id?: string
          type?: string
          call_id?: string
          saved_path?: string
        }
      }

      if (event.type === CODEX_SESSION_EVENT_TYPES.sessionMeta && event.payload?.id) {
        sessionId = event.payload.id
      }

      if (event.payload?.type === CODEX_SESSION_PAYLOAD_TYPES.imageGenerationEnd) {
        if (event.payload.saved_path) {
          imagePaths.push(event.payload.saved_path)
          continue
        }

        const imageSessionId = sessionId ?? fallbackSessionId

        if (imageSessionId && event.payload.call_id) {
          imagePaths.push(path.join(homedir(), '.codex', 'generated_images', imageSessionId, `${event.payload.call_id}.png`))
        }
      }
    }

    return imagePaths
  } catch {
    return []
  }
}
