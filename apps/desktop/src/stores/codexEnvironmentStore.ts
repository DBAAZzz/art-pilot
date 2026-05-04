import type { CodexEnvironment, CodexUsageSummary } from '@art-pilot/shared'
import { create } from 'zustand'

type CodexEnvironmentStore = {
  environment: CodexEnvironment | null
  usage: CodexUsageSummary | null
  refreshing: boolean
  refreshEnvironment: () => Promise<void>
}

let refreshPromise: Promise<void> | null = null

export const useCodexEnvironmentStore = create<CodexEnvironmentStore>((set, get) => ({
  environment: null,
  usage: null,
  refreshing: false,
  refreshEnvironment: async () => {
    if (refreshPromise) {
      return refreshPromise
    }

    refreshPromise = refreshCodexEnvironment(set, get).finally(() => {
      refreshPromise = null
    })

    return refreshPromise
  },
}))

async function refreshCodexEnvironment(
  set: (partial: Partial<CodexEnvironmentStore>) => void,
  get: () => CodexEnvironmentStore,
) {
  set({ refreshing: true })

  try {
    const [environment, usage] = await Promise.all([
      window.api.detectCodexEnvironment(),
      window.api.readCodexUsage(),
    ])
    const current = get()

    set({
      environment: areCodexEnvironmentsEqual(current.environment, environment)
        ? current.environment
        : environment,
      usage: areCodexUsageSummariesEqual(current.usage, usage)
        ? current.usage
        : usage,
    })
  } finally {
    set({ refreshing: false })
  }
}

function areCodexEnvironmentsEqual(left: CodexEnvironment | null, right: CodexEnvironment) {
  if (!left) {
    return false
  }

  return left.installed === right.installed
    && left.available === right.available
    && left.loggedIn === right.loggedIn
    && left.executablePath === right.executablePath
    && left.version === right.version
    && left.loginKind === right.loginKind
    && left.loginStatus === right.loginStatus
    && left.error === right.error
}

function areCodexUsageSummariesEqual(left: CodexUsageSummary | null, right: CodexUsageSummary) {
  if (!left) {
    return false
  }

  return JSON.stringify(left) === JSON.stringify(right)
}
