import { useEffect, useState } from 'react'

import { SettingsList, SettingsPanelHeader, SettingsRow } from '../components/SettingPanelPrimitives'

export function AboutPanel() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    window.api.getAppVersion()
      .then((appVersion) => {
        if (active) {
          setVersion(appVersion)
        }
      })
      .catch(() => {
        if (active) {
          setVersion(null)
        }
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <SettingsPanelHeader description="应用版本和运行环境信息" title="关于 Art Pilot" />
      <SettingsList>
        <SettingsRow
          description="反馈问题时请附带这个版本号"
          title="应用版本"
          action={<span className="font-mono text-base text-text-strong">{version ? `v${version}` : '-'}</span>}
        />
        <SettingsRow
          description="当前内置 Electron 运行时版本"
          title="Electron"
          action={<span className="font-mono text-base text-text-strong">v{window.versions.electron()}</span>}
        />
        <SettingsRow
          description="当前内置 Node.js 运行时版本"
          title="Node.js"
          action={<span className="font-mono text-base text-text-strong">v{window.versions.node()}</span>}
        />
      </SettingsList>
    </>
  )
}
