export type CodexImageCleanupPolicy = 'after-import' | 'never'
export type CodexSessionCleanupPolicy = 'after-import' | 'after-days' | 'never'

export type AppSettings = {
  imageLibraryPath: string
  codexImageCleanup: CodexImageCleanupPolicy
  codexSessionCleanup: CodexSessionCleanupPolicy
}

export type UpdateAppSettingsRequest = Partial<Pick<AppSettings, 'imageLibraryPath' | 'codexImageCleanup'>>
