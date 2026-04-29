export {}

import type { ElectronApi, VersionsApi } from '@art-pilot/shared'

declare global {
  interface Window {
    versions: VersionsApi
    api: ElectronApi
  }
}
