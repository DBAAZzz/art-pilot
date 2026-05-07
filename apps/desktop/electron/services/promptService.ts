import { randomUUID } from 'node:crypto'
import {
  findUndefinedPromptVariables,
  getImageVariableMaxCount,
  normalizePromptVariableKey,
  resolvePromptTemplateContent,
  validatePromptVariableKey,
} from '@art-pilot/shared'
import type {
  PromptPreviewImage,
  PromptRecord,
  PromptSourceSite,
  PromptTemplate,
  PromptTemplateDraft,
  PromptVariable,
  PromptVariableValue,
  ResolvePromptTemplateRequest,
  ResolvedPromptTemplate,
  SavePromptRequest,
} from '@art-pilot/shared'
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
  variables_json?: string
  preview_images_json: string
  created_at: number
  updated_at: number
}

const PROMPT_SOURCE_SITES = new Set<PromptSourceSite>(['manual', 'youmind', 'other'])

export class PromptService {
  constructor(private readonly databaseService: DatabaseService) {}

  savePrompt(request: SavePromptRequest): PromptRecord {
    return this.savePromptTemplate(request)
  }

  savePromptTemplate(request: PromptTemplateDraft): PromptTemplate {
    const normalizedPrompt = normalizePromptTemplateDraft(request)
    const now = Date.now()
    const promptId = randomUUID()

    logger.info(
      'saving prompt template: id=%s sourceSite=%s hasSourceUrl=%s titleLength=%d contentLength=%d variables=%d',
      promptId,
      normalizedPrompt.sourceSite,
      String(Boolean(normalizedPrompt.sourceUrl)),
      normalizedPrompt.title.length,
      normalizedPrompt.content.length,
      normalizedPrompt.variables.length,
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
          variables_json,
          preview_images_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        JSON.stringify(normalizedPrompt.variables),
        JSON.stringify(normalizedPrompt.previewImages),
        now,
        now,
      )

    return this.getPromptById(promptId)
  }

  listPrompts(): PromptRecord[] {
    return this.listPromptTemplates()
  }

  listPromptTemplates(): PromptTemplate[] {
    const rows = this.databaseService
      .getConnection()
      .prepare('SELECT * FROM prompts ORDER BY updated_at DESC')
      .all() as PromptRow[]

    return rows.map(mapPromptRow)
  }

  resolvePromptTemplate(request: ResolvePromptTemplateRequest): ResolvedPromptTemplate {
    if (!request || typeof request !== 'object') {
      throw new Error('模板解析参数不正确')
    }

    const templateId = normalizeRequiredText(request.templateId, '模板 ID 不能为空')
    const template = this.getPromptById(templateId)
    const values = normalizePromptVariableValues(request.values)
    const result = resolvePromptTemplateContent(template.content, template.variables, values)

    if (result.errors.length > 0) {
      throw new Error(result.errors[0])
    }

    if (!result.generationPrompt.trim()) {
      throw new Error('解析后的 Prompt 为空')
    }

    return {
      prompt: result.generationPrompt,
      previewPrompt: result.previewPrompt,
      imageInputs: result.imageVariableMappings,
    }
  }

  private getPromptById(promptId: string) {
    const row = this.databaseService
      .getConnection()
      .prepare('SELECT * FROM prompts WHERE id = ? LIMIT 1')
      .get(promptId) as PromptRow | undefined

    if (!row) {
      throw new Error('提示词模板不存在')
    }

    return mapPromptRow(row)
  }
}

function normalizePromptTemplateDraft(request: PromptTemplateDraft): PromptTemplateDraft {
  if (!request || typeof request !== 'object') {
    throw new Error('提示词保存参数不正确')
  }

  const title = normalizeRequiredText(request.title, '模板标题不能为空')
  const content = normalizeRequiredText(request.content, 'Prompt 内容不能为空')
  const sourceSite = PROMPT_SOURCE_SITES.has(request.sourceSite) ? request.sourceSite : 'manual'
  const variables = normalizePromptVariables(request.variables)
  const undefinedKeys = findUndefinedPromptVariables(content, variables)

  if (undefinedKeys.length > 0) {
    throw new Error(`Prompt 中存在尚未定义的变量：${undefinedKeys.join(', ')}`)
  }

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
    variables,
    previewImages: normalizePreviewImages(request.previewImages),
  }
}

function normalizePromptVariables(value: unknown): PromptVariable[] {
  if (!Array.isArray(value)) {
    return []
  }

  const variables: PromptVariable[] = []
  const keys = new Set<string>()

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const rawKey = 'key' in item ? item.key : ''
    const key = typeof rawKey === 'string' ? normalizePromptVariableKey(rawKey) : ''

    if (!validatePromptVariableKey(key)) {
      throw new Error('变量名只能包含小写英文、数字和下划线，并以英文开头')
    }

    if (keys.has(key)) {
      throw new Error(`存在重复变量名：${key}`)
    }

    keys.add(key)

    const label = normalizeOptionalText('label' in item ? item.label : undefined) ?? key
    const required = 'required' in item ? Boolean(item.required) : true
    const description = normalizeOptionalText('description' in item ? item.description : undefined)

    if ('type' in item && item.type === 'image') {
      const maxCount = normalizePositiveInteger('maxCount' in item ? item.maxCount : undefined) ?? 1
      const role = normalizeImageVariableRole('role' in item ? item.role : undefined)

      variables.push({
        key,
        label,
        type: 'image',
        required,
        description,
        maxCount: getImageVariableMaxCount({ key, label, type: 'image', required, maxCount }),
        role,
      })
      continue
    }

    variables.push({
      key,
      label,
      type: 'text',
      required,
      description,
      defaultValue: normalizeOptionalText('defaultValue' in item ? item.defaultValue : undefined),
      placeholder: normalizeOptionalText('placeholder' in item ? item.placeholder : undefined),
    })
  }

  return variables
}

function normalizePromptVariableValues(value: unknown): PromptVariableValue[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item): PromptVariableValue[] => {
    if (!item || typeof item !== 'object' || !('key' in item) || typeof item.key !== 'string') {
      return []
    }

    const key = normalizePromptVariableKey(item.key)

    if (!validatePromptVariableKey(key)) {
      return []
    }

    if ('type' in item && item.type === 'image') {
      return [{
        key,
        type: 'image',
        imageIds: normalizeStringArray('imageIds' in item ? item.imageIds : []),
      }]
    }

    return [{
      key,
      type: 'text',
      value: typeof ('value' in item ? item.value : undefined) === 'string' ? item.value : '',
    }]
  })
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
    variables: parseJsonArray(row.variables_json ?? '[]', isPromptVariable),
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

function normalizePositiveInteger(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return undefined
  }

  return Math.floor(numberValue)
}

function normalizeImageVariableRole(value: unknown) {
  return value === 'reference' || value === 'character' || value === 'style' || value === 'composition'
    ? value
    : undefined
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

function isPromptVariable(value: unknown): value is PromptVariable {
  if (!value || typeof value !== 'object') {
    return false
  }

  if (!('key' in value) || typeof value.key !== 'string' || !validatePromptVariableKey(value.key)) {
    return false
  }

  if (!('label' in value) || typeof value.label !== 'string') {
    return false
  }

  if (!('required' in value) || typeof value.required !== 'boolean') {
    return false
  }

  return 'type' in value && (value.type === 'text' || value.type === 'image')
}
