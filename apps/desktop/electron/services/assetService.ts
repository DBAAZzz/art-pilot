import path from 'node:path'
import type {
  AssetGenerationParams,
  AssetImage,
  AssetImageDetail,
  AssetListQuery,
  AssetListResult,
  AssetStats,
  GenerationTaskStatus,
  ImageReference,
  PromptImageBinding,
  PromptVariableValue,
} from '@art-pilot/shared'
import type { DatabaseService } from './databaseService'
import { warmAssetThumbnailCache } from '../protocols/generatedImageProtocol'
import { generatedImageRegistry } from '../protocols/generatedImageRegistry'
import { createLogger } from '../utils/logger'

const logger = createLogger('art-pilot:asset-service')

type AssetRow = {
  image_id: string
  task_id: string
  codex_thread_id: string | null
  image_index: number
  library_path: string
  file_size: number | null
  width: number | null
  height: number | null
  favorite: number
  cleanup_status: string
  cleanup_error: string | null
  image_created_at: number
  moved_at: number
  prompt: string
  count: number
  aspect_ratio: string | null
  size: string | null
  generation_params: string | null
  references_json: string | null
  prompt_template_id: string | null
  prompt_template_title: string | null
  prompt_template_values_json: string | null
  prompt_template_image_bindings_json: string | null
  status: GenerationTaskStatus
  task_error: string | null
  task_created_at: number
  completed_at: number | null
}

type CountRow = {
  total: number
}

type StatsRow = {
  image_count: number
  total_bytes: number | null
  month_image_count: number
  month_bytes: number | null
}

export class AssetService {
  constructor(private readonly databaseService: DatabaseService) {}

  listAssets(query: AssetListQuery = {}): AssetListResult {
    const limit = normalizeLimit(query.limit)
    const offset = normalizeOffset(query.offset)
    const { whereSql, params } = buildAssetWhere(query)

    logger.info(
      'listing assets: limit=%d offset=%d hasSearch=%s favoriteOnly=%s',
      limit,
      offset,
      String(Boolean(query.search?.trim())),
      String(Boolean(query.favoriteOnly)),
    )

    const totalRow = this.databaseService
      .getConnection()
      .prepare(`SELECT COUNT(*) AS total FROM generated_images gi JOIN generation_tasks gt ON gt.id = gi.task_id ${whereSql}`)
      .get(...params) as CountRow

    const rows = this.databaseService
      .getConnection()
      .prepare(`
        SELECT
          gi.id AS image_id,
          gi.task_id,
          gt.codex_thread_id,
          gi.image_index,
          gi.library_path,
          gi.file_size,
          gi.width,
          gi.height,
          gi.favorite,
          gi.cleanup_status,
          gi.cleanup_error,
          gi.created_at AS image_created_at,
          gi.moved_at,
          gt.prompt,
          gt.count,
          gt.aspect_ratio,
          gt.size,
          gt.generation_params,
          gt.references_json,
          gt.prompt_template_id,
          gt.prompt_template_title,
          gt.prompt_template_values_json,
          gt.prompt_template_image_bindings_json,
          gt.status,
          gt.error AS task_error,
          gt.created_at AS task_created_at,
          gt.completed_at
        FROM generated_images gi
        JOIN generation_tasks gt ON gt.id = gi.task_id
        ${whereSql}
        ORDER BY gi.created_at DESC, gi.image_index ASC
        LIMIT ? OFFSET ?
      `)
      .all(...params, limit, offset) as AssetRow[]

    const items = rows.map(mapAssetRowToAssetImage)
    warmAssetThumbnailCache(items.map((item) => ({
      imageId: item.imageId,
      imagePath: item.imagePath,
    })))

    return {
      items,
      total: totalRow.total,
      offset,
      limit,
    }
  }

  getAssetDetail(imageId: string): AssetImageDetail | null {
    const normalizedImageId = normalizeImageId(imageId)

    const row = this.databaseService
      .getConnection()
      .prepare(`
        SELECT
          gi.id AS image_id,
          gi.task_id,
          gt.codex_thread_id,
          gi.image_index,
          gi.library_path,
          gi.file_size,
          gi.width,
          gi.height,
          gi.favorite,
          gi.cleanup_status,
          gi.cleanup_error,
          gi.created_at AS image_created_at,
          gi.moved_at,
          gt.prompt,
          gt.count,
          gt.aspect_ratio,
          gt.size,
          gt.generation_params,
          gt.references_json,
          gt.prompt_template_id,
          gt.prompt_template_title,
          gt.prompt_template_values_json,
          gt.prompt_template_image_bindings_json,
          gt.status,
          gt.error AS task_error,
          gt.created_at AS task_created_at,
          gt.completed_at
        FROM generated_images gi
        JOIN generation_tasks gt ON gt.id = gi.task_id
        WHERE gi.id = ?
        LIMIT 1
      `)
      .get(normalizedImageId) as AssetRow | undefined

    if (!row) {
      return null
    }

    const siblingRows = this.databaseService
      .getConnection()
      .prepare('SELECT id, image_index, library_path FROM generated_images WHERE task_id = ? ORDER BY image_index ASC')
      .all(row.task_id) as Array<{ id: string; image_index: number; library_path: string }>

    const references = parseReferences(row.references_json).map((reference, index) => {
      generatedImageRegistry.registerReference(row.task_id, index, reference.path)

      return {
        ...reference,
        imageUrl: generatedImageRegistry.createReferenceImageUrl(row.task_id, index),
      }
    })

    return {
      ...mapAssetRowToAssetImage(row),
      generationParams: parseGenerationParams(row.generation_params),
      promptTemplateUse: parsePromptTemplateUse(row),
      references,
      siblingImages: siblingRows.map((image) => {
        generatedImageRegistry.register(row.task_id, image.image_index, image.library_path)

        return {
          imageId: image.id,
          index: image.image_index,
          imagePath: image.library_path,
          imageUrl: generatedImageRegistry.createGeneratedImageUrl(row.task_id, image.image_index),
        }
      }),
    }
  }

  getStats(): AssetStats {
    const currentMonthStart = new Date()
    currentMonthStart.setDate(1)
    currentMonthStart.setHours(0, 0, 0, 0)

    const row = this.databaseService
      .getConnection()
      .prepare(`
        SELECT
          COUNT(*) AS image_count,
          COALESCE(SUM(file_size), 0) AS total_bytes,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS month_image_count,
          COALESCE(SUM(CASE WHEN created_at >= ? THEN file_size ELSE 0 END), 0) AS month_bytes
        FROM generated_images
      `)
      .get(currentMonthStart.getTime(), currentMonthStart.getTime()) as StatsRow

    return {
      imageCount: row.image_count ?? 0,
      totalBytes: row.total_bytes ?? 0,
      monthImageCount: row.month_image_count ?? 0,
      monthBytes: row.month_bytes ?? 0,
    }
  }

  setFavorite(imageId: string, favorite: boolean) {
    const normalizedImageId = normalizeImageId(imageId)
    logger.info('setting asset favorite: imageId=%s favorite=%s', normalizedImageId, String(favorite))
    this.databaseService
      .getConnection()
      .prepare('UPDATE generated_images SET favorite = ? WHERE id = ?')
      .run(favorite ? 1 : 0, normalizedImageId)
  }
}

function mapAssetRowToAssetImage(row: AssetRow): AssetImage {
  generatedImageRegistry.register(row.task_id, row.image_index, row.library_path)
  generatedImageRegistry.registerAsset(row.image_id, row.library_path)

  return {
    imageId: row.image_id,
    jobId: row.task_id,
    codexThreadId: row.codex_thread_id ?? undefined,
    index: row.image_index,
    imagePath: row.library_path,
    imageUrl: generatedImageRegistry.createAssetOriginalUrl(row.image_id),
    thumbnailUrl: generatedImageRegistry.createAssetThumbnailUrl(row.image_id),
    fileName: path.basename(row.library_path),
    fileSize: row.file_size ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    prompt: row.prompt,
    aspectRatio: row.aspect_ratio ?? undefined,
    size: row.size ?? undefined,
    status: row.status,
    favorite: row.favorite === 1,
    cleanupStatus: row.cleanup_status,
    cleanupError: row.cleanup_error ?? undefined,
    createdAt: row.image_created_at,
    movedAt: row.moved_at,
    taskCreatedAt: row.task_created_at,
    taskCompletedAt: row.completed_at ?? undefined,
    referenceCount: parseReferences(row.references_json).length,
  }
}

function buildAssetWhere(query: AssetListQuery) {
  const clauses: string[] = []
  const params: unknown[] = []

  if (query.favoriteOnly) {
    clauses.push('gi.favorite = 1')
  }

  const search = query.search?.trim()

  if (search) {
    clauses.push('(gt.prompt LIKE ? OR gi.library_path LIKE ? OR gi.id LIKE ? OR gi.task_id LIKE ?)')
    const pattern = `%${search}%`
    params.push(pattern, pattern, pattern, pattern)
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  }
}

function normalizeLimit(limit: unknown) {
  return Math.min(Math.max(Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 40, 1), 100)
}

function normalizeOffset(offset: unknown) {
  return Math.max(Number.isFinite(Number(offset)) ? Math.trunc(Number(offset)) : 0, 0)
}

function normalizeImageId(imageId: unknown) {
  if (typeof imageId !== 'string' || imageId.trim().length === 0) {
    throw new Error('图片 ID 不能为空')
  }

  return imageId.trim()
}

function parseReferences(referencesJson: string | null): ImageReference[] {
  if (!referencesJson) {
    return []
  }

  try {
    const parsedReferences = JSON.parse(referencesJson)

    if (!Array.isArray(parsedReferences)) {
      return []
    }

    return parsedReferences.filter(isImageReference)
  } catch {
    return []
  }
}

function isImageReference(value: unknown): value is ImageReference {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const reference = value as Partial<ImageReference>

  return typeof reference.id === 'string'
    && reference.kind === 'local-file'
    && typeof reference.path === 'string'
}

function parseGenerationParams(value: string | null): AssetGenerationParams | undefined {
  if (!value) {
    return undefined
  }

  try {
    const parsedValue = JSON.parse(value) as AssetGenerationParams

    return typeof parsedValue === 'object' && parsedValue !== null ? parsedValue : undefined
  } catch {
    return undefined
  }
}

function parsePromptTemplateUse(row: AssetRow): AssetImageDetail['promptTemplateUse'] | undefined {
  if (!row.prompt_template_id) {
    return undefined
  }

  return {
    templateId: row.prompt_template_id,
    templateTitle: row.prompt_template_title ?? undefined,
    values: parseJsonArray<PromptVariableValue>(row.prompt_template_values_json),
    imageBindings: parseJsonArray<PromptImageBinding>(row.prompt_template_image_bindings_json),
  }
}

function parseJsonArray<T>(value: string | null): T[] {
  if (!value) {
    return []
  }

  try {
    const parsedValue = JSON.parse(value)

    return Array.isArray(parsedValue) ? parsedValue as T[] : []
  } catch {
    return []
  }
}
