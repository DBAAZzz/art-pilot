export const IPC_CHANNELS = {
  file: {
    readOneTextFile: 'file:read-one-text-file',
  },
} as const

export interface VersionsApi {
  node: () => string
  chrome: () => string
  electron: () => string
}

export interface ElectronApi {
  readTxtFile: () => Promise<string>
}

