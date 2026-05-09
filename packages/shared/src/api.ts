import type { CodexEnvironment, CodexUsageSummary } from './codex'
import type { AssetImageDetail, AssetListQuery, AssetListResult, AssetStats } from './assets'
import type { ImageHistoryTask } from './imageHistory'
import type {
  ImageGenerationEvent,
  ImageGenerationRequest,
  ImageGenerationStartResult,
  ImageReference,
} from './imageGeneration'
import type {
  PromptImportDraft,
  PromptRecord,
  PromptTemplate,
  PromptTemplateDraft,
  ResolvedPromptTemplate,
  ResolvePromptTemplateRequest,
  SavePromptRequest,
  UpdatePromptTemplateRequest,
} from './prompt'
import type { AppSettings, UpdateAppSettingsRequest } from './settings'

export interface VersionsApi {
  node: () => string
  chrome: () => string
  electron: () => string
}

export interface ElectronApi {
  readTxtFile: () => Promise<string>
  detectCodexEnvironment: () => Promise<CodexEnvironment>
  readCodexUsage: () => Promise<CodexUsageSummary>
  // 正确调用顺序：先注册 onImageGenerationEvent，再调用 startImageGeneration，避免漏掉早期事件。
  startImageGeneration: (request: ImageGenerationRequest) => Promise<ImageGenerationStartResult>
  onImageGenerationEvent: (callback: (event: ImageGenerationEvent) => void) => () => void
  cancelImageGeneration: (jobId: string) => Promise<void>
  selectImageReferences: () => Promise<ImageReference[]>
  pasteImageReferencesFromClipboard: () => Promise<ImageReference[]>
  getPathForFile: (file: File) => string
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: UpdateAppSettingsRequest) => Promise<AppSettings>
  selectImageLibraryFolder: (currentPath?: string) => Promise<string | null>
  listRecentImageTasks: (limit?: number) => Promise<ImageHistoryTask[]>
  listAssets: (query?: AssetListQuery) => Promise<AssetListResult>
  getAssetDetail: (imageId: string) => Promise<AssetImageDetail | null>
  getAssetStats: () => Promise<AssetStats>
  setAssetFavorite: (imageId: string, favorite: boolean) => Promise<void>
  openImageLibraryFolder: () => Promise<void>
  openImageFileLocation: (imagePath: string) => Promise<void>
  openExternalUrl: (url: string) => Promise<void>
  fillPromptTemplateFromUrl: (url: string) => Promise<PromptTemplateDraft>
  savePromptTemplate: (draft: PromptTemplateDraft) => Promise<PromptTemplate>
  updatePromptTemplate: (request: UpdatePromptTemplateRequest) => Promise<PromptTemplate>
  listPromptTemplates: () => Promise<PromptTemplate[]>
  getPromptTemplateById: (templateId: string) => Promise<PromptTemplate | null>
  resolvePromptTemplate: (request: ResolvePromptTemplateRequest) => Promise<ResolvedPromptTemplate>
  addAssetToPromptTemplatePreview: (templateId: string, imageId: string) => Promise<PromptTemplate>
  previewPromptImport: (url: string) => Promise<PromptImportDraft>
  savePrompt: (request: SavePromptRequest) => Promise<PromptRecord>
  listPrompts: () => Promise<PromptRecord[]>
  toggleWindowMaximize: () => Promise<void>
}
