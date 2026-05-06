import type { PromptImportDraft, PromptPreviewImage } from '@art-pilot/shared'
import { createLogger, formatUrlForLog } from '../utils/logger'

const logger = createLogger('art-pilot:prompt-import-service')

type CreativeWorkJsonLd = {
  '@type'?: string
  name?: string
  description?: string
  text?: string
  inLanguage?: string
  datePublished?: string
  image?: string | string[]
  isBasedOn?: string
  url?: string
  author?: {
    name?: string
    url?: string
  }
}

export class PromptImportService {
  async previewImport(url: string): Promise<PromptImportDraft> {
    const promptUrl = normalizeYouMindPromptUrl(url)
    logger.info('previewing prompt import: url=%s', formatUrlForLog(promptUrl))

    const response = await fetch(promptUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'Mozilla/5.0 Art Pilot Prompt Importer',
      },
    })

    if (!response.ok) {
      throw new Error(`无法读取网页：HTTP ${response.status}`)
    }

    const html = await response.text()
    const creativeWork = extractCreativeWork(html)
    const title = normalizeText(creativeWork?.name) ?? extractTitle(html)
    const content = normalizeText(creativeWork?.text) ?? extractPromptContent(html)

    if (!title) {
      throw new Error('没有解析到提示词标题')
    }

    if (!content) {
      throw new Error('没有解析到提示词内容')
    }

    const sourceUrl = creativeWork?.url ? normalizeUrl(creativeWork.url) : promptUrl
    const previewImages = extractPreviewImages(creativeWork, html, title)

    return {
      title,
      content,
      description: normalizeText(creativeWork?.description) ?? extractMetaContent(html, 'description'),
      sourceSite: 'youmind',
      sourceUrl,
      sourceAuthor: normalizeText(creativeWork?.author?.name),
      originalSourceUrl: normalizeOptionalUrl(creativeWork?.isBasedOn ?? creativeWork?.author?.url),
      originalLanguage: normalizeText(creativeWork?.inLanguage),
      categories: extractCategories(html),
      previewImages,
    }
  }
}

function normalizeYouMindPromptUrl(value: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('请输入提示词详情页链接')
  }

  let url: URL

  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('链接格式不正确')
  }

  if (url.hostname !== 'youmind.com' || !url.pathname.includes('/prompts/')) {
    throw new Error('目前只支持 YouMind 提示词详情页')
  }

  url.hash = ''
  return url.toString()
}

function extractCreativeWork(html: string): CreativeWorkJsonLd | undefined {
  const jsonScripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? []

  for (const script of jsonScripts) {
    const jsonText = stripScriptTag(script)

    try {
      const parsed = JSON.parse(decodeHtmlEntities(jsonText)) as unknown
      const creativeWork = findCreativeWork(parsed)

      if (creativeWork) {
        return creativeWork
      }
    } catch {
      continue
    }
  }

  return undefined
}

function findCreativeWork(value: unknown): CreativeWorkJsonLd | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  if ('@type' in value && value['@type'] === 'CreativeWork') {
    return value as CreativeWorkJsonLd
  }

  if ('@graph' in value && Array.isArray(value['@graph'])) {
    return value['@graph'].find((entry) => (
      Boolean(entry)
      && typeof entry === 'object'
      && '@type' in entry
      && entry['@type'] === 'CreativeWork'
    )) as CreativeWorkJsonLd | undefined
  }

  return undefined
}

function stripScriptTag(script: string) {
  return script.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '')
}

function extractTitle(html: string) {
  const h1Title = matchFirst(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const title = h1Title ?? matchFirst(html, /<title>([\s\S]*?)<\/title>/i)

  return normalizeText(stripTags(title ?? '').replace(/\s+-\s+GPT Image[\s\S]*$/, ''))
}

function extractPromptContent(html: string) {
  const promptContent = matchFirst(html, /"promptContent":"((?:\\.|[^"\\])*)"/)

  if (!promptContent) {
    return undefined
  }

  return normalizeText(unescapeJsonString(promptContent))
}

function extractMetaContent(html: string, name: string) {
  const escapedName = escapeRegExp(name)
  const content = matchFirst(html, new RegExp(`<meta[^>]+name=["']${escapedName}["'][^>]+content=["']([^"']+)["']`, 'i'))

  return normalizeText(decodeHtmlEntities(content ?? '').replace(/\s+——\s+[\s\S]*$/, ''))
}

function extractCategories(html: string) {
  const categoryBlock = matchFirst(html, /<dt[^>]*>\s*分类\s*<\/dt><dd[^>]*>([\s\S]*?)<\/dd>/i) ?? html
  const categories = [...categoryBlock.matchAll(/href=["'][^"']*gpt-image-2-prompts\?categories=[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => normalizeText(stripTags(match[1])))
    .filter((category): category is string => Boolean(category))

  return [...new Set(categories)]
}

function extractPreviewImages(creativeWork: CreativeWorkJsonLd | undefined, html: string, title: string): PromptPreviewImage[] {
  const images: PromptPreviewImage[] = []
  const creativeWorkImages = Array.isArray(creativeWork?.image)
    ? creativeWork.image
    : creativeWork?.image ? [creativeWork.image] : []

  for (const imageUrl of creativeWorkImages) {
    const normalizedUrl = normalizeOptionalUrl(imageUrl)

    if (normalizedUrl) {
      images.push({ url: normalizedUrl, alt: title })
    }
  }

  for (const imageUrl of extractCmsAssetUrls(html)) {
    if (!images.some((image) => image.url === imageUrl)) {
      images.push({ url: imageUrl, alt: title })
    }
  }

  return images.slice(0, 6)
}

function extractCmsAssetUrls(html: string) {
  const urls = [...html.matchAll(/https%3A%2F%2Fcms-assets\.youmind\.com%2Fmedia%2F[^"'\s,]+|https:\/\/cms-assets\.youmind\.com\/media\/[^"'\s,]+/gi)]
    .map((match) => decodeURIComponent(match[0]).replace(/&amp;.*$/, ''))
    .map(normalizeOptionalUrl)
    .filter((url): url is string => Boolean(url))

  return [...new Set(urls)]
}

function matchFirst(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, '')
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }

  const text = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  return text || undefined
}

function normalizeUrl(value: string) {
  return new URL(value).toString()
}

function normalizeOptionalUrl(value: unknown) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return undefined
  }

  try {
    return normalizeUrl(value.trim())
  } catch {
    return undefined
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function unescapeJsonString(value: string) {
  try {
    return JSON.parse(`"${value}"`) as string
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\n/g, '\n')
  }
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
