import { execFile, spawn } from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'
import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { promisify } from 'node:util'
import { createLogger } from './logger'

const execFileAsync = promisify(execFile)
const logger = createLogger('art-pilot:codex-cli')
const CODEX_APP_CLI_PATH = '/Applications/Codex.app/Contents/Resources/codex'
const COMMON_CODEX_PATHS = [
  CODEX_APP_CLI_PATH,
  '/opt/homebrew/bin/codex',
  '/usr/local/bin/codex',
  '/usr/bin/codex',
]

export type CodexExecOptions = {
  ephemeral?: boolean
  sandbox?: 'read-only' | 'workspace-write'
  timeoutMs?: number
}

export type CodexStreamingExecOptions = {
  ephemeral?: boolean
  sandbox?: 'read-only' | 'workspace-write'
  images?: string[]
  startupTimeoutMs?: number
  inactivityTimeoutMs?: number
  absoluteTimeoutMs?: number
  stderrTailBytes?: number
}

export const CODEX_STREAM_EVENT_TYPES = {
  threadStarted: 'thread-started',
  message: 'message',
  taskComplete: 'task-complete',
} as const

const CODEX_JSON_EVENT_TYPES = {
  threadStarted: 'thread.started',
  sessionMeta: 'session_meta',
  turnCompleted: 'turn.completed',
} as const

const CODEX_JSON_ITEM_TYPES = {
  agentMessage: 'agent_message',
  assistantMessage: 'message',
  outputText: 'output_text',
  taskComplete: 'task_complete',
} as const

export type CodexStreamEvent =
  | {
      type: typeof CODEX_STREAM_EVENT_TYPES.threadStarted
      threadId: string
    }
  | {
      type: typeof CODEX_STREAM_EVENT_TYPES.message
      text: string
      revisedPrompt?: string
      callId?: string
    }
  | {
      type: typeof CODEX_STREAM_EVENT_TYPES.taskComplete
    }

export type CodexStreamingCallbacks = {
  onEvent?: (event: CodexStreamEvent) => void
  onValidJsonLine?: () => void
  onStderr?: (chunk: string, stderrTail: string) => void
  onExit?: (result: { code: number | null; signal: NodeJS.Signals | null; stderrTail: string }) => void
  onError?: (error: Error, stderrTail: string) => void
  onTimeout?: (kind: 'startup' | 'inactivity' | 'absolute', stderrTail: string) => void
}

type CodexJsonStreamItem = {
  id?: string
  type?: string
  thread_id?: string
  call_id?: string
  saved_path?: string
  revised_prompt?: string
  message?: string
  text?: string
  last_agent_message?: string
  role?: string
  content?: Array<{
    type?: string
    text?: string
  }>
}

type CodexJsonStreamEvent = {
  type?: string
  thread_id?: string
  payload?: CodexJsonStreamItem
  item?: CodexJsonStreamItem
}

export function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

async function canAccessExecutable(filePath: string) {
  try {
    await access(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export async function findCodexExecutable() {
  const pathValue = [
    process.env.PATH,
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    '/Applications/Codex.app/Contents/Resources',
  ]
    .filter(Boolean)
    .join(':')

  try {
    // 优先按当前进程 PATH 查找；Electron 从桌面启动时 PATH 可能比终端少，所以这里主动补常见目录。
    const { stdout } = await execFileAsync('zsh', ['-lc', 'command -v codex'], {
      env: {
        ...process.env,
        PATH: pathValue,
      },
      timeout: 5000,
    })
    const executablePath = stdout.trim()

    if (executablePath) {
      return executablePath
    }
  } catch {
    // command -v 找不到时继续走固定路径兜底，不把它当成最终错误。
    logger.debug('command -v codex failed, trying known paths')
  }

  // Codex 桌面应用会内置 CLI；桌面环境没有 shell PATH 时，这个路径更可靠。
  for (const filePath of COMMON_CODEX_PATHS) {
    if (await canAccessExecutable(filePath)) {
      logger.debug('found codex executable at %s', filePath)
      return filePath
    }
  }

  return null
}

export function runCodexExec(executablePath: string, prompt: string, options: CodexExecOptions = {}) {
  return new Promise<string>((resolve, reject) => {
    const args = [
      'exec',
      '--skip-git-repo-check',
      '--sandbox',
      options.sandbox ?? 'read-only',
      '--color',
      'never',
    ]

    if (options.ephemeral) {
      args.push('--ephemeral')
    }

    args.push('-')

    const child = spawn(executablePath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false

    const settle = (callback: () => void) => {
      if (settled) {
        return
      }

      settled = true
      callback()
    }

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      settle(() => reject(error))
    })
    child.on('close', (code) => {
      settle(() => {
        if (code === 0) {
          resolve(stdout)
          return
        }

        reject(new Error(stderr || stdout || `codex exec exited with code ${code}`))
      })
    })

    // Codex 在非 TTY 子进程里会读取 stdin；这里显式写入 prompt 并关闭，避免一直等待输入。
    child.stdin.end(prompt)

    if (options.timeoutMs) {
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        settle(() => reject(new Error(`codex exec timed out after ${options.timeoutMs}ms`)))
      }, options.timeoutMs)

      child.on('close', () => {
        clearTimeout(timer)
      })
    }
  })
}

export function runCodexExecStreaming(
  executablePath: string,
  prompt: string,
  callbacks: CodexStreamingCallbacks = {},
  options: CodexStreamingExecOptions = {},
) {
  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    options.sandbox ?? 'workspace-write',
    '--color',
    'never',
  ]

  if (options.ephemeral) {
    args.push('--ephemeral')
  }

  for (const imagePath of options.images ?? []) {
    args.push('--image', imagePath)
  }

  args.push('-')
  logger.info(
    'spawning codex streaming exec: executable=%s sandbox=%s images=%d promptLength=%d startupTimeoutMs=%s inactivityTimeoutMs=%s absoluteTimeoutMs=%s',
    executablePath,
    options.sandbox ?? 'workspace-write',
    options.images?.length ?? 0,
    prompt.length,
    String(options.startupTimeoutMs ?? 'none'),
    String(options.inactivityTimeoutMs ?? 'none'),
    String(options.absoluteTimeoutMs ?? 'none'),
  )

  const child = spawn(executablePath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  logger.info('codex streaming exec spawned: pid=%s', String(child.pid ?? 'unknown'))

  const stderrTailBytes = options.stderrTailBytes ?? 16 * 1024
  let stdoutBuffer = ''
  let stderrTail = ''
  let sawValidJsonLine = false
  let settled = false
  let startupTimer: NodeJS.Timeout | undefined
  let inactivityTimer: NodeJS.Timeout | undefined
  let absoluteTimer: NodeJS.Timeout | undefined

  const clearTimers = () => {
    if (startupTimer) {
      clearTimeout(startupTimer)
    }

    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }

    if (absoluteTimer) {
      clearTimeout(absoluteTimer)
    }
  }

  const settle = (callback: () => void) => {
    if (settled) {
      return
    }

    settled = true
    clearTimers()
    callback()
  }

  const resetInactivityTimer = () => {
    if (!options.inactivityTimeoutMs || settled) {
      return
    }

    if (inactivityTimer) {
      clearTimeout(inactivityTimer)
    }

    inactivityTimer = setTimeout(() => {
      logger.error('codex streaming exec inactivity timeout: pid=%s timeoutMs=%d', String(child.pid ?? 'unknown'), options.inactivityTimeoutMs)
      child.kill('SIGTERM')
      settle(() => callbacks.onTimeout?.('inactivity', stderrTail))
    }, options.inactivityTimeoutMs)
  }

  const markValidJsonLine = () => {
    if (!sawValidJsonLine) {
      sawValidJsonLine = true

      if (startupTimer) {
        clearTimeout(startupTimer)
        startupTimer = undefined
      }

      logger.info('codex streaming exec produced first valid JSONL event: pid=%s', String(child.pid ?? 'unknown'))
    }

    callbacks.onValidJsonLine?.()
  }

  const handleLine = (line: string) => {
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      return
    }

    const event = extractCodexStreamEvent(trimmedLine)

    if (!event) {
      return
    }

    markValidJsonLine()
    logger.debug('codex streaming event extracted: pid=%s type=%s', String(child.pid ?? 'unknown'), event.type)
    callbacks.onEvent?.(event)
  }

  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')

  child.stdout.on('data', (chunk: string) => {
    resetInactivityTimer()
    stdoutBuffer += chunk

    const lines = stdoutBuffer.split(/\r?\n/)
    stdoutBuffer = lines.pop() ?? ''

    for (const line of lines) {
      handleLine(line)
    }
  })

  child.stderr.on('data', (chunk: string) => {
    resetInactivityTimer()
    stderrTail = trimStderrTail(`${stderrTail}${chunk}`, stderrTailBytes)
    logger.debug(
      'codex streaming stderr received: pid=%s chunkBytes=%d tailBytes=%d',
      String(child.pid ?? 'unknown'),
      Buffer.byteLength(chunk, 'utf8'),
      Buffer.byteLength(stderrTail, 'utf8'),
    )
    callbacks.onStderr?.(chunk, stderrTail)
  })

  child.on('error', (error) => {
    logger.error('codex streaming exec spawn/runtime error: pid=%s error=%s', String(child.pid ?? 'unknown'), error.message)
    settle(() => callbacks.onError?.(error, stderrTail))
  })

  child.on('close', (code, signal) => {
    if (stdoutBuffer) {
      handleLine(stdoutBuffer)
      stdoutBuffer = ''
    }

    logger.info('codex streaming exec closed: pid=%s code=%s signal=%s', String(child.pid ?? 'unknown'), String(code), String(signal))
    settle(() => callbacks.onExit?.({ code, signal, stderrTail }))
  })

  child.stdin.end(prompt)
  logger.debug('codex streaming prompt written to stdin and closed: pid=%s', String(child.pid ?? 'unknown'))

  if (options.startupTimeoutMs) {
    startupTimer = setTimeout(() => {
      logger.error('codex streaming exec startup timeout: pid=%s timeoutMs=%d', String(child.pid ?? 'unknown'), options.startupTimeoutMs)
      child.kill('SIGTERM')
      settle(() => callbacks.onTimeout?.('startup', stderrTail))
    }, options.startupTimeoutMs)
  }

  if (options.absoluteTimeoutMs) {
    absoluteTimer = setTimeout(() => {
      logger.error('codex streaming exec absolute timeout: pid=%s timeoutMs=%d', String(child.pid ?? 'unknown'), options.absoluteTimeoutMs)
      child.kill('SIGTERM')
      settle(() => callbacks.onTimeout?.('absolute', stderrTail))
    }, options.absoluteTimeoutMs)
  }

  resetInactivityTimer()

  return child
}

function trimStderrTail(value: string, maxBytes: number) {
  if (Buffer.byteLength(value, 'utf8') <= maxBytes) {
    return value
  }

  return Buffer.from(value, 'utf8').subarray(-maxBytes).toString('utf8')
}

function extractCodexStreamEvent(line: string): CodexStreamEvent | null {
  try {
    const event = JSON.parse(line, (_key, value) => {
      if (_key === 'result') {
        return undefined
      }

      return value
    }) as CodexJsonStreamEvent

    if (event.type === CODEX_JSON_EVENT_TYPES.threadStarted || event.type === CODEX_JSON_EVENT_TYPES.sessionMeta) {
      const threadId = event.thread_id ?? event.payload?.thread_id ?? event.payload?.id

      if (threadId) {
        return {
          type: CODEX_STREAM_EVENT_TYPES.threadStarted,
          threadId,
        }
      }
    }

    const payload = event.payload ?? event.item

    if (!payload?.type) {
      if (event.type === CODEX_JSON_EVENT_TYPES.turnCompleted) {
        return {
          type: CODEX_STREAM_EVENT_TYPES.taskComplete,
        }
      }

      return null
    }

    if (payload.type === CODEX_JSON_ITEM_TYPES.taskComplete) {
      if (typeof payload.last_agent_message === 'string' && payload.last_agent_message.trim()) {
        return {
          type: CODEX_STREAM_EVENT_TYPES.message,
          text: payload.last_agent_message,
        }
      }

      return {
        type: CODEX_STREAM_EVENT_TYPES.taskComplete,
      }
    }

    const message = extractCodexMessage(payload)

    if (typeof message === 'string' && message.trim()) {
      return {
        type: CODEX_STREAM_EVENT_TYPES.message,
        text: message,
        callId: payload.call_id,
        revisedPrompt: payload.revised_prompt,
      }
    }
  } catch (error) {
    logger.warn(
      'ignored unparsable codex output line: bytes=%d error=%s',
      Buffer.byteLength(line, 'utf8'),
      error instanceof Error ? error.message : String(error),
    )
  }

  return null
}

function extractCodexMessage(payload: CodexJsonStreamItem) {
  if (payload.type === CODEX_JSON_ITEM_TYPES.agentMessage) {
    return payload.message ?? payload.text
  }

  return payload.message ?? payload.text ?? extractResponseItemMessage(payload)
}

function extractResponseItemMessage(payload: CodexJsonStreamItem) {
  if (payload.type !== CODEX_JSON_ITEM_TYPES.assistantMessage || payload.role !== 'assistant') {
    return undefined
  }

  const textItems = payload.content
    ?.filter((item) => item.type === CODEX_JSON_ITEM_TYPES.outputText && typeof item.text === 'string')
    .map((item) => item.text?.trim())
    .filter(Boolean)

  return textItems?.join('\n')
}

export type CodexStreamingChildProcess = ChildProcessWithoutNullStreams
