import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { CodexEnvironment, CodexLoginKind, CodexUsageSummary } from '@art-pilot/shared'
import { readCodexUsageFromSessions } from '../utils/codexUsage'
import { findCodexExecutable, normalizeError } from '../utils/codexCli'
import { createLogger } from '../utils/logger'

const execFileAsync = promisify(execFile)
const logger = createLogger('art-pilot:codex')

function parseLoginKind(output: string): CodexLoginKind {
  const text = output.toLowerCase()

  if (text.includes('chatgpt')) {
    return 'chatgpt'
  }

  if (text.includes('api key') || text.includes('api-key')) {
    return 'api-key'
  }

  return 'unknown'
}

export class CodexService {
  async readUsage(): Promise<CodexUsageSummary> {
    return readCodexUsageFromSessions()
  }

  async detectEnvironment(): Promise<CodexEnvironment> {
    try {
      // 第一步：查找 codex CLI。桌面 App 的 PATH 经常不同于终端，所以要有固定路径兜底。
      const executablePath = await findCodexExecutable()

      if (!executablePath) {
        return {
          installed: false,
          available: false,
          loggedIn: false,
          error: '未找到 codex 命令',
        }
      }

      // 第二步：执行版本命令，确认 CLI 不只是存在，而且当前机器可运行。
      const { stdout: versionOutput } = await execFileAsync(executablePath, ['--version'], {
        timeout: 5000,
      })

      try {
        // 第三步：用 Codex CLI 官方登录状态命令判断认证状态。
        // exit code 0 表示已登录；非 0 会进入 catch，表示未登录或认证失效。
        const { stdout: loginOutput } = await execFileAsync(executablePath, ['login', 'status'], {
          timeout: 5000,
        })
        const loginStatus = loginOutput.trim()

        return {
          installed: true,
          available: true,
          loggedIn: true,
          executablePath,
          version: versionOutput.trim(),
          loginKind: parseLoginKind(loginStatus),
          loginStatus,
        }
      } catch (error) {
        logger.warn('codex login status failed: %s', normalizeError(error))
        return {
          installed: true,
          available: true,
          loggedIn: false,
          executablePath,
          version: versionOutput.trim(),
          error: normalizeError(error),
        }
      }
    } catch (error) {
      logger.error('failed to detect Codex environment: %s', normalizeError(error))
      return {
        installed: false,
        available: false,
        loggedIn: false,
        error: normalizeError(error),
      }
    }
  }
}
