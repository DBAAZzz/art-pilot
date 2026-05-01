import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline'
import type { CodexRateLimitWindow, CodexTokenBreakdown, CodexUsageSummary } from '@art-pilot/shared'
import { createLogger } from './logger'

const logger = createLogger('art-pilot:codex-usage')

type CodexTokenUsage = {
  input_tokens?: number
  output_tokens?: number
  cached_input_tokens?: number
  cache_read_input_tokens?: number
  reasoning_output_tokens?: number
}

type CodexTotals = {
  input: number
  output: number
  cached: number
  reasoning: number
}

type CodexParseState = {
  previousTotals?: CodexTotals
}

type ParsedCodexUsage = {
  tokenEvents: number
  totals: CodexTokenBreakdown
  primaryRateLimit?: CodexRateLimitWindow
  secondaryRateLimit?: CodexRateLimitWindow
  updatedAt?: number
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function emptyTokenBreakdown(): CodexTokenBreakdown {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    reasoning: 0,
    total: 0,
  }
}

function addTokenBreakdown(left: CodexTokenBreakdown, right: CodexTokenBreakdown): CodexTokenBreakdown {
  const input = left.input + right.input
  const output = left.output + right.output
  const cacheRead = left.cacheRead + right.cacheRead
  const reasoning = left.reasoning + right.reasoning

  return {
    input,
    output,
    cacheRead,
    reasoning,
    total: input + output + cacheRead + reasoning,
  }
}

function toNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toTotals(usage: CodexTokenUsage): CodexTotals {
  return {
    input: Math.max(0, usage.input_tokens ?? 0),
    output: Math.max(0, usage.output_tokens ?? 0),
    cached: Math.max(0, usage.cached_input_tokens ?? usage.cache_read_input_tokens ?? 0),
    reasoning: Math.max(0, usage.reasoning_output_tokens ?? 0),
  }
}

function totalsEqual(left: CodexTotals, right: CodexTotals) {
  return left.input === right.input && left.output === right.output && left.cached === right.cached && left.reasoning === right.reasoning
}

function totalsDelta(current: CodexTotals, previous: CodexTotals): CodexTotals | null {
  if (
    current.input < previous.input ||
    current.output < previous.output ||
    current.cached < previous.cached ||
    current.reasoning < previous.reasoning
  ) {
    return null
  }

  return {
    input: current.input - previous.input,
    output: current.output - previous.output,
    cached: current.cached - previous.cached,
    reasoning: current.reasoning - previous.reasoning,
  }
}

function addTotals(left: CodexTotals, right: CodexTotals): CodexTotals {
  return {
    input: left.input + right.input,
    output: left.output + right.output,
    cached: left.cached + right.cached,
    reasoning: left.reasoning + right.reasoning,
  }
}

function totalsTotal(totals: CodexTotals) {
  return totals.input + totals.output + totals.cached + totals.reasoning
}

function looksLikeStaleRegression(current: CodexTotals, previous: CodexTotals, last: CodexTotals) {
  const previousTotal = totalsTotal(previous)
  const currentTotal = totalsTotal(current)
  const lastTotal = totalsTotal(last)

  if (previousTotal <= 0 || currentTotal <= 0 || lastTotal <= 0) {
    return false
  }

  return currentTotal * 100 >= previousTotal * 98 || currentTotal + lastTotal * 2 >= previousTotal
}

function totalsToBreakdown(totals: CodexTotals): CodexTokenBreakdown {
  const cacheRead = Math.min(totals.cached, totals.input)
  const input = Math.max(0, totals.input - cacheRead)
  const output = Math.max(0, totals.output)
  const reasoning = Math.max(0, totals.reasoning)

  return {
    input,
    output,
    cacheRead,
    reasoning,
    total: input + output + cacheRead + reasoning,
  }
}

function readUsageObject(value: unknown): CodexTokenUsage | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const usage = value as Record<string, unknown>

  return {
    input_tokens: toNumber(usage.input_tokens),
    output_tokens: toNumber(usage.output_tokens),
    cached_input_tokens: toNumber(usage.cached_input_tokens),
    cache_read_input_tokens: toNumber(usage.cache_read_input_tokens),
    reasoning_output_tokens: toNumber(usage.reasoning_output_tokens),
  }
}

function parseRateLimit(value: unknown): CodexRateLimitWindow | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const rateLimit = value as Record<string, unknown>
  const usedPercent = toNumber(rateLimit.used_percent)

  if (usedPercent === undefined) {
    return undefined
  }

  return {
    usedPercent,
    remainingPercent: Math.max(0, 100 - usedPercent),
    windowMinutes: toNumber(rateLimit.window_minutes),
    resetsAt: toNumber(rateLimit.resets_at),
  }
}

async function findSessionFiles(directoryPath: string): Promise<string[]> {
  let entries

  try {
    entries = await readdir(directoryPath, { withFileTypes: true })
  } catch {
    return []
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name)

      if (entry.isDirectory()) {
        return findSessionFiles(entryPath)
      }

      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        return [entryPath]
      }

      return []
    }),
  )

  return files.flat()
}

function parseTokenCountEntry(entry: unknown, state: CodexParseState): CodexTokenBreakdown | null {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const root = entry as Record<string, unknown>

  if (root.type !== 'event_msg') {
    return null
  }

  const payload = root.payload as Record<string, unknown> | undefined

  if (!payload || payload.type !== 'token_count') {
    return null
  }

  const info = payload.info as Record<string, unknown> | undefined

  if (!info) {
    return null
  }

  const totalUsage = readUsageObject(info.total_token_usage)
  const lastUsage = readUsageObject(info.last_token_usage)
  const total = totalUsage ? toTotals(totalUsage) : undefined
  const last = lastUsage ? toTotals(lastUsage) : undefined
  const previous = state.previousTotals
  let tokens: CodexTokenBreakdown | null = null
  let nextTotals: CodexTotals | undefined

  // Codex JSONL 里的 total_token_usage 是累积快照；这里维护 previousTotals 计算增量。
  // last_token_usage 更接近本轮真实增量，所以优先使用它，total 只用于去重和基线推进。
  if (total && last && previous) {
    if (totalsEqual(total, previous)) {
      return null
    }

    if (!totalsDelta(total, previous) && looksLikeStaleRegression(total, previous, last)) {
      return null
    }

    tokens = totalsToBreakdown(last)
    nextTotals = total
  } else if (total && last) {
    tokens = totalsToBreakdown(last)
    nextTotals = total
  } else if (total && previous) {
    if (totalsEqual(total, previous)) {
      return null
    }

    const delta = totalsDelta(total, previous)

    if (!delta) {
      state.previousTotals = total
      return null
    }

    tokens = totalsToBreakdown(delta)
    nextTotals = total
  } else if (total) {
    tokens = totalsToBreakdown(total)
    nextTotals = total
  } else if (last && previous) {
    tokens = totalsToBreakdown(last)
    nextTotals = addTotals(previous, last)
  } else if (last) {
    tokens = totalsToBreakdown(last)
  }

  if (!tokens || tokens.total === 0) {
    return null
  }

  state.previousTotals = nextTotals
  return tokens
}

function readRateLimits(entry: unknown): Pick<ParsedCodexUsage, 'primaryRateLimit' | 'secondaryRateLimit'> {
  if (!entry || typeof entry !== 'object') {
    return {}
  }

  const root = entry as Record<string, unknown>
  const payload = root.payload as Record<string, unknown> | undefined
  const rateLimits = payload?.rate_limits as Record<string, unknown> | undefined

  return {
    primaryRateLimit: parseRateLimit(rateLimits?.primary),
    secondaryRateLimit: parseRateLimit(rateLimits?.secondary),
  }
}

async function parseSessionFile(filePath: string): Promise<ParsedCodexUsage> {
  const state: CodexParseState = {}
  let tokenEvents = 0
  let totals = emptyTokenBreakdown()
  let primaryRateLimit: CodexRateLimitWindow | undefined
  let secondaryRateLimit: CodexRateLimitWindow | undefined

  const reader = createInterface({
    crlfDelay: Infinity,
    input: createReadStream(filePath, { encoding: 'utf8' }),
  })

  for await (const line of reader) {
    const trimmed = line.trim()

    if (!trimmed) {
      continue
    }

    let entry: unknown

    try {
      entry = JSON.parse(trimmed)
    } catch {
      logger.debug('skip invalid Codex JSONL line in %s', filePath)
      continue
    }

    const tokens = parseTokenCountEntry(entry, state)

    if (tokens) {
      tokenEvents += 1
      totals = addTokenBreakdown(totals, tokens)
    }

    const rateLimits = readRateLimits(entry)
    primaryRateLimit = rateLimits.primaryRateLimit ?? primaryRateLimit
    secondaryRateLimit = rateLimits.secondaryRateLimit ?? secondaryRateLimit
  }

  const fileStat = await stat(filePath)

  return {
    tokenEvents,
    totals,
    primaryRateLimit,
    secondaryRateLimit,
    updatedAt: fileStat.mtimeMs,
  }
}

export async function readCodexUsageFromSessions(): Promise<CodexUsageSummary> {
  const sessionsPath = path.join(homedir(), '.codex', 'sessions')

  try {
    // 第一步：递归扫描 ~/.codex/sessions，Codex 实际会按 年/月/日 存放 JSONL。
    const sessionFiles = await findSessionFiles(sessionsPath)
    let tokenEvents = 0
    let totals = emptyTokenBreakdown()
    let primaryRateLimit: CodexRateLimitWindow | undefined
    let secondaryRateLimit: CodexRateLimitWindow | undefined
    let updatedAt: number | undefined

    for (const sessionFile of sessionFiles) {
      // 第二步：逐行读取 JSONL，避免一次性把大 session 文件全部载入内存。
      const parsed = await parseSessionFile(sessionFile)

      tokenEvents += parsed.tokenEvents
      totals = addTokenBreakdown(totals, parsed.totals)

      if (!updatedAt || (parsed.updatedAt && parsed.updatedAt > updatedAt)) {
        updatedAt = parsed.updatedAt
        primaryRateLimit = parsed.primaryRateLimit ?? primaryRateLimit
        secondaryRateLimit = parsed.secondaryRateLimit ?? secondaryRateLimit
      }
    }

    return {
      sessionsPath,
      filesScanned: sessionFiles.length,
      tokenEvents,
      totals,
      primaryRateLimit,
      secondaryRateLimit,
      updatedAt,
    }
  } catch (error) {
    logger.error('failed to read Codex usage: %s', normalizeError(error))

    return {
      sessionsPath,
      filesScanned: 0,
      tokenEvents: 0,
      totals: emptyTokenBreakdown(),
      error: normalizeError(error),
    }
  }
}
