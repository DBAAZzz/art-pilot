export const IPC_CHANNELS = {
  file: {
    readOneTextFile: 'file:read-one-text-file',
  },
  window: {
    toggleMaximize: 'window:toggle-maximize',
  },
} as const

export interface VersionsApi {
  node: () => string
  chrome: () => string
  electron: () => string
}

export interface ElectronApi {
  readTxtFile: () => Promise<string>
  toggleWindowMaximize: () => Promise<void>
}
