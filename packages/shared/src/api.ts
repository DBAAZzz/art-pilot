import type { CodexEnvironment, CodexUsageSummary } from './codex'
import type { ImageHistoryTask } from './imageHistory'
import type {
  ImageGenerationEvent,
  ImageGenerationRequest,
  ImageGenerationStartResult,
  ImageReference,
} from './imageGeneration'
import type { PromptImportDraft, PromptRecord, SavePromptRequest } from './prompt'
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
  openImageLibraryFolder: () => Promise<void>
  openImageFileLocation: (imagePath: string) => Promise<void>
  openExternalUrl: (url: string) => Promise<void>
  previewPromptImport: (url: string) => Promise<PromptImportDraft>
  savePrompt: (request: SavePromptRequest) => Promise<PromptRecord>
  listPrompts: () => Promise<PromptRecord[]>
  toggleWindowMaximize: () => Promise<void>
}
