import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'
import type { ImageGenerationEvent, ImageGenerationRequest } from '@art-pilot/shared'

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
  toggleWindowMaximize: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.window.toggleMaximize)
  },
})
