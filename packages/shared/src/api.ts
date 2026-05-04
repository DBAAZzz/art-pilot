import type { CodexEnvironment, CodexUsageSummary } from './codex'
import type { ImageHistoryTask } from './imageHistory'
import type { ImageGenerationEvent, ImageGenerationRequest, ImageGenerationStartResult } from './imageGeneration'
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
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: UpdateAppSettingsRequest) => Promise<AppSettings>
  selectImageLibraryFolder: (currentPath?: string) => Promise<string | null>
  listRecentImageTasks: (limit?: number) => Promise<ImageHistoryTask[]>
  openImageLibraryFolder: () => Promise<void>
  toggleWindowMaximize: () => Promise<void>
}
