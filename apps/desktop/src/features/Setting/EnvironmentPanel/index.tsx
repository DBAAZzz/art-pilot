import type { CodexEnvironment } from '@art-pilot/shared'
import { useEffect, useState } from 'react'

import { SettingsList, SettingsPanelHeader, SettingsRow } from '../SettingPanelPrimitives'

function getLoginText(environment: CodexEnvironment | null, loading: boolean) {
  if (loading) {
    return '检测中'
  }

  if (!environment?.installed) {
    return '未安装'
  }

  if (!environment.available) {
    return '不可用'
  }

  return environment.loggedIn ? '已登录' : '未登录'
}

function getLoginKindText(environment: CodexEnvironment | null) {
  if (!environment?.loggedIn) {
    return '未认证'
  }

  if (environment.loginKind === 'chatgpt') {
    return 'ChatGPT'
  }

  if (environment.loginKind === 'api-key') {
    return 'API key'
  }

  return '已认证'
}

export function EnvironmentPanel() {
  const [environment, setEnvironment] = useState<CodexEnvironment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true

    async function detectCodexEnvironment() {
      setLoading(true)

      try {
        const result = await window.api.detectCodexEnvironment()
        console.log('Codex Environment:', result)
        const usage = await window.api.readCodexUsage()
        console.log('Codex Usage:', usage)

        if (alive) {
          setEnvironment(result)
        }
      } finally {
        if (alive) {
          setLoading(false)
        }
      }
    }

    void detectCodexEnvironment()

    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <SettingsPanelHeader description="Codex 登录状态和账号信息" title="环境检测" />
      <SettingsList>
        <SettingsRow
          description={environment?.loginStatus || environment?.error || '通过 codex login status 判断终端认证状态'}
          title="登录状态"
          action={<span className="text-base font-semibold text-text-strong">{getLoginText(environment, loading)}</span>}
        />
        <SettingsRow
          description="根据 CLI 状态输出判断认证来源"
          title="登录方式"
          action={<span className="truncate text-base font-semibold text-text-strong">{getLoginKindText(environment)}</span>}
        />
        <SettingsRow
          description="通过 command -v codex 查找当前终端可用命令"
          title="CLI 安装"
          action={<span className="text-base font-semibold text-text-strong">{environment?.installed ? '已安装' : '未安装'}</span>}
        />
        <SettingsRow
          description="命令行工具可被调用"
          title="CLI 版本"
          action={<span className="text-base font-semibold text-text-strong">{environment?.version || '-'}</span>}
        />
        <SettingsRow
          description="来自当前终端 PATH"
          title="CLI 路径"
          action={<span className="truncate text-base font-semibold text-text-strong">{environment?.executablePath || '-'}</span>}
        />
      </SettingsList>
    </>
  )
}
