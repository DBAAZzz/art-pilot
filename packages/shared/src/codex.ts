export type CodexLoginKind = 'chatgpt' | 'api-key' | 'unknown'

export type CodexEnvironment = {
  installed: boolean
  available: boolean
  loggedIn: boolean
  executablePath?: string
  version?: string
  loginKind?: CodexLoginKind
  loginStatus?: string
  error?: string
}

export type CodexTokenBreakdown = {
  input: number
  output: number
  cacheRead: number
  reasoning: number
  total: number
}

export type CodexRateLimitWindow = {
  usedPercent: number
  remainingPercent: number
  windowMinutes?: number
  resetsAt?: number
}

export type CodexUsageSummary = {
  sessionsPath: string
  filesScanned: number
  tokenEvents: number
  totals: CodexTokenBreakdown
  primaryRateLimit?: CodexRateLimitWindow
  secondaryRateLimit?: CodexRateLimitWindow
  updatedAt?: number
  error?: string
}
