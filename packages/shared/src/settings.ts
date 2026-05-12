export type CodexImageCleanupPolicy = 'after-import' | 'never'
export type CodexSessionCleanupPolicy = 'after-import' | 'after-days' | 'never'

export type AppSettings = {
  imageLibraryPath: string
  imagePathTemplate: string
  stripImageMetadata: boolean
  codexImageCleanup: CodexImageCleanupPolicy
  codexSessionCleanup: CodexSessionCleanupPolicy
}

export const DEFAULT_IMAGE_PATH_TEMPLATE = '{YYYY}-{MM}/{jobId}_{index}'

export const IMAGE_PATH_TEMPLATE_VARIABLES = ['YYYY', 'MM', 'DD', 'jobId', 'index'] as const

export type UpdateAppSettingsRequest = Partial<Pick<AppSettings, 'imageLibraryPath' | 'imagePathTemplate' | 'stripImageMetadata' | 'codexImageCleanup'>>
