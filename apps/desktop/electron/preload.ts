import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { AssetListQuery } from '@art-pilot/shared'
import type { ImageGenerationEvent, ImageGenerationRequest } from '@art-pilot/shared'
import type { PromptTemplateDraft, ResolvePromptTemplateRequest, SavePromptRequest, UpdatePromptTemplateRequest } from '@art-pilot/shared'
import type { UpdateAppSettingsRequest } from '@art-pilot/shared'

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
})


contextBridge.exposeInMainWorld('api', {
  readTxtFile: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.file.readOneTextFile)
  },
  detectCodexEnvironment: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.codex.detectEnvironment)
  },
  readCodexUsage: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.codex.readUsage)
  },
  startImageGeneration: (request: ImageGenerationRequest) => {
    return ipcRenderer.invoke(IPC_CHANNELS.image.generateStart, request)
  },
  onImageGenerationEvent: (callback: (event: ImageGenerationEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, generationEvent: ImageGenerationEvent) => {
      callback(generationEvent)
    }

    ipcRenderer.on(IPC_CHANNELS.image.generationEvent, listener)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.image.generationEvent, listener)
    }
  },
  cancelImageGeneration: (jobId: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.image.cancel, jobId)
  },
  selectImageReferences: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.image.selectReferences)
  },
  pasteImageReferencesFromClipboard: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.image.pasteReferences)
  },
  getPathForFile: (file: File) => {
    return webUtils.getPathForFile(file)
  },
  getSettings: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.settings.get)
  },
  updateSettings: (settings: UpdateAppSettingsRequest) => {
    return ipcRenderer.invoke(IPC_CHANNELS.settings.update, settings)
  },
  selectImageLibraryFolder: (currentPath?: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.settings.selectImageLibraryFolder, currentPath)
  },
  listRecentImageTasks: (limit?: number) => {
    return ipcRenderer.invoke(IPC_CHANNELS.imageHistory.listRecent, limit)
  },
  listAssets: (query?: AssetListQuery) => {
    return ipcRenderer.invoke(IPC_CHANNELS.assets.list, query)
  },
  getAssetDetail: (imageId: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.assets.getDetail, imageId)
  },
  getAssetStats: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.assets.getStats)
  },
  setAssetFavorite: (imageId: string, favorite: boolean) => {
    return ipcRenderer.invoke(IPC_CHANNELS.assets.setFavorite, imageId, favorite)
  },
  openImageLibraryFolder: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.imageHistory.openLibraryFolder)
  },
  openImageFileLocation: (imagePath: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.imageHistory.openImageFileLocation, imagePath)
  },
  getAppVersion: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.system.getAppVersion)
  },
  openExternalUrl: (url: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.system.openExternalUrl, url)
  },
  fillPromptTemplateFromUrl: (url: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.fillFromUrl, url)
  },
  savePromptTemplate: (request: PromptTemplateDraft) => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.saveTemplate, request)
  },
  updatePromptTemplate: (request: UpdatePromptTemplateRequest) => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.updateTemplate, request)
  },
  listPromptTemplates: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.listTemplates)
  },
  getPromptTemplateById: (templateId: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.getTemplate, templateId)
  },
  resolvePromptTemplate: (request: ResolvePromptTemplateRequest) => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.resolveTemplate, request)
  },
  addAssetToPromptTemplatePreview: (templateId: string, imageId: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.addAssetPreviewImage, templateId, imageId)
  },
  previewPromptImport: (url: string) => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.previewImport, url)
  },
  savePrompt: (request: SavePromptRequest) => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.save, request)
  },
  listPrompts: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.prompt.list)
  },
  toggleWindowMaximize: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.window.toggleMaximize)
  },
})
