export type PromptSourceSite = 'youmind' | 'manual' | 'other'

export type PromptPreviewImage = {
  url: string
  alt?: string
}

export type PromptVariableType = 'text' | 'image'

export type PromptVariableBase = {
  key: string
  label: string
  required: boolean
  description?: string
}

export type PromptTextVariable = PromptVariableBase & {
  type: 'text'
  defaultValue?: string
  placeholder?: string
}

export type PromptImageVariable = PromptVariableBase & {
  type: 'image'
  maxCount?: number
  role?: 'reference' | 'character' | 'style' | 'composition'
}

export type PromptVariable = PromptTextVariable | PromptImageVariable

export type PromptVariableValue =
  | {
      key: string
      type: 'text'
      value: string
    }
  | {
      key: string
      type: 'image'
      imageIds: string[]
    }

export type PromptImageInput = {
  id: string
  name?: string
  filePath?: string
  dataUrl?: string
}

export type PromptTemplate = {
  id: string
  title: string
  content: string
  description?: string
  sourceSite: PromptSourceSite
  sourceUrl?: string
  sourceAuthor?: string
  originalSourceUrl?: string
  originalLanguage?: string
  categories: string[]
  variables: PromptVariable[]
  previewImages: PromptPreviewImage[]
  createdAt: number
  updatedAt: number
}

export type PromptTemplateDraft = Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>

export type ResolvePromptTemplateRequest = {
  templateId: string
  values: PromptVariableValue[]
}

export type ResolvedPromptTemplate = {
  prompt: string
  previewPrompt: string
  imageInputs: Array<{
    variableKey: string
    role?: PromptImageVariable['role']
    imageIds: string[]
  }>
}

export type ResolvePromptTemplateContentResult = {
  generationPrompt: string
  previewPrompt: string
  imageVariableMappings: ResolvedPromptTemplate['imageInputs']
  errors: string[]
}

export type PromptRecord = PromptTemplate

export type PromptImportDraft = PromptTemplateDraft

export type SavePromptRequest = PromptTemplateDraft

export type UpdatePromptTemplateRequest = PromptTemplateDraft & {
  id: string
}
