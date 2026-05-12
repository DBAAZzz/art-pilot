import { DEFAULT_IMAGE_PATH_TEMPLATE, IMAGE_PATH_TEMPLATE_VARIABLES } from './settings'

export type ImagePathTemplateContext = {
  createdAt: Date
  jobId: string
  index: number
}

export type TemplateValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

const ALLOWED_CHARS_PATTERN = /^[a-zA-Z0-9\-_/.\{\}]+$/
const CONSECUTIVE_SLASHES_PATTERN = /\/{2,}/
const KNOWN_VARIABLE_PATTERN = /\{([^}]+)\}/g

export function validateImagePathTemplate(template: string): TemplateValidationResult {
  if (!template.trim()) {
    return { valid: false, reason: '模板不能为空' }
  }

  if (template.startsWith('/')) {
    return { valid: false, reason: '模板不能以 / 开头（不允许绝对路径）' }
  }

  if (template.includes('..')) {
    return { valid: false, reason: '模板不能包含 ..（不允许路径穿越）' }
  }

  if (CONSECUTIVE_SLASHES_PATTERN.test(template)) {
    return { valid: false, reason: '模板不能包含连续的 /' }
  }

  if (!ALLOWED_CHARS_PATTERN.test(template)) {
    return { valid: false, reason: '模板仅允许字母、数字、-、_、/、. 和模板变量' }
  }

  if (!template.includes('{index}')) {
    return { valid: false, reason: '模板必须包含 {index} 以确保文件名唯一' }
  }

  const allowedSet = new Set<string>(IMAGE_PATH_TEMPLATE_VARIABLES)
  for (const match of template.matchAll(KNOWN_VARIABLE_PATTERN)) {
    if (!allowedSet.has(match[1])) {
      return { valid: false, reason: `未知的模板变量：{${match[1]}}` }
    }
  }

  return { valid: true }
}

export function renderImagePathTemplate(template: string, context: ImagePathTemplateContext): string {
  const { createdAt, jobId, index } = context

  const variables: Record<string, string> = {
    YYYY: String(createdAt.getFullYear()),
    MM: String(createdAt.getMonth() + 1).padStart(2, '0'),
    DD: String(createdAt.getDate()).padStart(2, '0'),
    jobId,
    index: String(index).padStart(4, '0'),
  }

  return template.replace(KNOWN_VARIABLE_PATTERN, (_, key) => variables[key] ?? `{${key}}`)
}

export function getTemplatePreview(template: string): string {
  const sampleContext: ImagePathTemplateContext = {
    createdAt: new Date(),
    jobId: 'abc123',
    index: 1,
  }

  const validation = validateImagePathTemplate(template)
  if (!validation.valid) {
    return validation.reason
  }

  return renderImagePathTemplate(template, sampleContext) + '.png'
}

export function getSafeImagePathTemplate(template: string | undefined): string {
  if (!template) return DEFAULT_IMAGE_PATH_TEMPLATE
  const result = validateImagePathTemplate(template)
  return result.valid ? template : DEFAULT_IMAGE_PATH_TEMPLATE
}
