export type PromptSourceSite = 'youmind' | 'manual'

export type PromptPreviewImage = {
  url: string
  alt?: string
}

export type PromptRecord = {
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
  previewImages: PromptPreviewImage[]
  createdAt: number
  updatedAt: number
}

export type PromptImportDraft = Omit<PromptRecord, 'id' | 'createdAt' | 'updatedAt'>

export type SavePromptRequest = PromptImportDraft
