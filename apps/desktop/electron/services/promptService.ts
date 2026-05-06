import { randomUUID } from 'node:crypto'
import type { PromptPreviewImage, PromptRecord, PromptSourceSite, SavePromptRequest } from '@art-pilot/shared'
import type { DatabaseService } from './databaseService'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:prompt-service')

type PromptRow = {
  id: string
  title: string
  content: string
  description: string | null
  source_site: PromptSourceSite
  source_url: string | null
  source_author: string | null
  original_source_url: string | null
  original_language: string | null
  categories_json: string
  preview_images_json: string
  created_at: number
  updated_at: number
}

const PROMPT_SOURCE_SITES = new Set<PromptSourceSite>(['manual', 'youmind'])

export class PromptService {
  constructor(private readonly databaseService: DatabaseService) {}

  savePrompt(request: SavePromptRequest): PromptRecord {
    const normalizedPrompt = normalizeSavePromptRequest(request)
    const now = Date.now()
    const existingPrompt = normalizedPrompt.sourceUrl ? this.findBySourceUrl(normalizedPrompt.sourceUrl) : undefined
    const promptId = existingPrompt?.id ?? randomUUID()
    const createdAt = existingPrompt?.created_at ?? now

    logger.info(
      'saving prompt: id=%s sourceSite=%s hasSourceUrl=%s titleLength=%d contentLength=%d',
      promptId,
      normalizedPrompt.sourceSite,
      String(Boolean(normalizedPrompt.sourceUrl)),
      normalizedPrompt.title.length,
      normalizedPrompt.content.length,
    )

    this.databaseService
      .getConnection()
      .prepare(`
        INSERT INTO prompts (
          id,
          title,
          content,
          description,
          source_site,
          source_url,
          source_author,
          original_source_url,
          original_language,
          categories_json,
          preview_images_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(source_url) WHERE source_url IS NOT NULL DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          description = excluded.description,
          source_site = excluded.source_site,
          source_author = excluded.source_author,
          original_source_url = excluded.original_source_url,
          original_language = excluded.original_language,
          categories_json = excluded.categories_json,
          preview_images_json = excluded.preview_images_json,
          updated_at = excluded.updated_at
      `)
      .run(
        promptId,
        normalizedPrompt.title,
        normalizedPrompt.content,
        normalizedPrompt.description ?? null,
        normalizedPrompt.sourceSite,
        normalizedPrompt.sourceUrl ?? null,
        normalizedPrompt.sourceAuthor ?? null,
        normalizedPrompt.originalSourceUrl ?? null,
        normalizedPrompt.originalLanguage ?? null,
        JSON.stringify(normalizedPrompt.categories),
        JSON.stringify(normalizedPrompt.previewImages),
        createdAt,
        now,
      )

    return this.getPromptBySourceOrId(normalizedPrompt.sourceUrl, promptId)
  }

  listPrompts(): PromptRecord[] {
    const rows = this.databaseService
      .getConnection()
      .prepare('SELECT * FROM prompts ORDER BY updated_at DESC')
      .all() as PromptRow[]

    return rows.map(mapPromptRow)
  }

  private findBySourceUrl(sourceUrl: string) {
    return this.databaseService
      .getConnection()
      .prepare('SELECT * FROM prompts WHERE source_url = ? LIMIT 1')
      .get(sourceUrl) as PromptRow | undefined
  }

  private getPromptBySourceOrId(sourceUrl: string | undefined, promptId: string) {
    const row = sourceUrl
      ? this.findBySourceUrl(sourceUrl)
      : this.databaseService
        .getConnection()
        .prepare('SELECT * FROM prompts WHERE id = ? LIMIT 1')
        .get(promptId) as PromptRow | undefined

    if (!row) {
      throw new Error('保存提示词失败')
    }

    return mapPromptRow(row)
  }
}

function normalizeSavePromptRequest(request: SavePromptRequest): SavePromptRequest {
  if (!request || typeof request !== 'object') {
    throw new Error('提示词保存参数不正确')
  }

  const title = normalizeRequiredText(request.title, '提示词标题不能为空')
  const content = normalizeRequiredText(request.content, '提示词内容不能为空')
  const sourceSite = PROMPT_SOURCE_SITES.has(request.sourceSite) ? request.sourceSite : 'manual'

  return {
    title,
    content,
    description: normalizeOptionalText(request.description),
    sourceSite,
    sourceUrl: normalizeOptionalUrl(request.sourceUrl, '来源链接格式不正确'),
    sourceAuthor: normalizeOptionalText(request.sourceAuthor),
    originalSourceUrl: normalizeOptionalUrl(request.originalSourceUrl, '原始来源链接格式不正确'),
    originalLanguage: normalizeOptionalText(request.originalLanguage),
    categories: normalizeStringArray(request.categories),
    previewImages: normalizePreviewImages(request.previewImages),
  }
}

function mapPromptRow(row: PromptRow): PromptRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    description: row.description ?? undefined,
    sourceSite: row.source_site,
    sourceUrl: row.source_url ?? undefined,
    sourceAuthor: row.source_author ?? undefined,
    originalSourceUrl: row.original_source_url ?? undefined,
    originalLanguage: row.original_language ?? undefined,
    categories: parseJsonArray(row.categories_json, isString),
    previewImages: parseJsonArray(row.preview_images_json, isPromptPreviewImage),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeRequiredText(value: unknown, errorMessage: string) {
  const text = typeof value === 'string' ? value.trim() : ''

  if (!text) {
    throw new Error(errorMessage)
  }

  return text
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const text = value.trim()
  return text || undefined
}

function normalizeOptionalUrl(value: unknown, errorMessage: string) {
  const text = normalizeOptionalText(value)

  if (!text) {
    return undefined
  }

  try {
    return new URL(text).toString()
  } catch {
    throw new Error(errorMessage)
  }
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return [...new Set(value.map(normalizeOptionalText).filter(isString))]
}

function normalizePreviewImages(value: unknown): PromptPreviewImage[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((image) => {
    if (!isPromptPreviewImage(image)) {
      return []
    }

    return [{
      url: image.url.trim(),
      alt: normalizeOptionalText(image.alt),
    }]
  })
}

function parseJsonArray<T>(value: string, predicate: (item: unknown) => item is T): T[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter(predicate) : []
  } catch {
    return []
  }
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPromptPreviewImage(value: unknown): value is PromptPreviewImage {
  return (
    typeof value === 'object'
    && value !== null
    && 'url' in value
    && typeof value.url === 'string'
    && value.url.trim().length > 0
    && (!('alt' in value) || value.alt === undefined || typeof value.alt === 'string')
  )
}
