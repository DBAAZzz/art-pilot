import type {
  PromptImageVariable,
  PromptTextVariable,
  PromptVariable,
  PromptVariableValue,
  ResolvePromptTemplateContentResult,
} from './prompt'

const PROMPT_VARIABLE_PATTERN = /\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g
const PROMPT_VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/

export function extractPromptVariableKeys(content: string): string[] {
  const keys = new Set<string>()

  for (const match of content.matchAll(PROMPT_VARIABLE_PATTERN)) {
    keys.add(match[1])
  }

  return [...keys]
}

export function validatePromptVariableKey(key: string): boolean {
  return PROMPT_VARIABLE_KEY_PATTERN.test(key)
}

export function normalizePromptVariableKey(key: string): string {
  return key.trim().toLowerCase()
}

export function findUndefinedPromptVariables(content: string, variables: PromptVariable[]): string[] {
  const definedKeys = new Set(variables.map((variable) => variable.key))

  return extractPromptVariableKeys(content).filter((key) => !definedKeys.has(key))
}

export function resolvePromptTemplateContent(
  content: string,
  variables: PromptVariable[],
  values: PromptVariableValue[],
): ResolvePromptTemplateContentResult {
  const errors: string[] = []
  const variablesByKey = new Map(variables.map((variable) => [variable.key, variable]))
  const valuesByKey = new Map(values.map((value) => [value.key, value]))
  const imageVariableMappings: ResolvePromptTemplateContentResult['imageVariableMappings'] = []

  for (const variable of variables) {
    const value = valuesByKey.get(variable.key)

    if (variable.type === 'text') {
      const textValue = value?.type === 'text' ? value.value.trim() : ''

      if (variable.required && !textValue && !variable.defaultValue?.trim()) {
        errors.push(`请填写必填变量：${variable.label || variable.key}`)
      }

      continue
    }

    const imageIds = value?.type === 'image' ? uniqueNonEmptyStrings(value.imageIds) : []
    const maxCount = getImageVariableMaxCount(variable)

    if (variable.required && imageIds.length === 0) {
      errors.push(`请添加必填参考图：${variable.label || variable.key}`)
    }

    if (imageIds.length > maxCount) {
      errors.push(`${variable.label || variable.key} 最多支持 ${maxCount} 张图片`)
    }

    if (imageIds.length > 0) {
      imageVariableMappings.push({
        variableKey: variable.key,
        role: variable.role,
        imageIds: imageIds.slice(0, maxCount),
      })
    }
  }

  const generationPrompt = cleanResolvedPrompt(replacePromptVariables(content, variablesByKey, valuesByKey, 'generation'))
  const previewPrompt = cleanResolvedPrompt(replacePromptVariables(content, variablesByKey, valuesByKey, 'preview'))

  return {
    generationPrompt,
    previewPrompt,
    imageVariableMappings,
    errors,
  }
}

export function getImageVariableMaxCount(variable: PromptImageVariable): number {
  return Number.isFinite(variable.maxCount) && variable.maxCount && variable.maxCount > 0
    ? Math.max(1, Math.floor(variable.maxCount))
    : 1
}

function replacePromptVariables(
  content: string,
  variablesByKey: Map<string, PromptVariable>,
  valuesByKey: Map<string, PromptVariableValue>,
  mode: 'generation' | 'preview',
) {
  return content.replace(PROMPT_VARIABLE_PATTERN, (_placeholder, rawKey: string) => {
    const variable = variablesByKey.get(rawKey)

    if (!variable) {
      return ''
    }

    const value = valuesByKey.get(variable.key)

    if (variable.type === 'text') {
      return resolveTextVariable(variable, value)
    }

    const imageIds = value?.type === 'image' ? uniqueNonEmptyStrings(value.imageIds) : []

    if (mode === 'preview' && imageIds.length > 0) {
      return `【${variable.label || variable.key}：已选 ${imageIds.length} 张】`
    }

    return ''
  })
}

function resolveTextVariable(variable: PromptTextVariable, value: PromptVariableValue | undefined) {
  const textValue = value?.type === 'text' ? value.value.trim() : ''
  const defaultValue = variable.defaultValue?.trim() ?? ''

  return textValue || defaultValue
}

function cleanResolvedPrompt(value: string) {
  return value
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function uniqueNonEmptyStrings(value: string[]) {
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))]
}
