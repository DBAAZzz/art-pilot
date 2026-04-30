import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@art-pilot/shared'

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
})


contextBridge.exposeInMainWorld('api', {
  readTxtFile: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.file.readOneTextFile)
  },
  toggleWindowMaximize: () => {
    return ipcRenderer.invoke(IPC_CHANNELS.window.toggleMaximize)
  },
})
