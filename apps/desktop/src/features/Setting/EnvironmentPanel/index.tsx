import { SettingsList, SettingsPanelHeader, SettingsRow } from '../SettingPanelPrimitives'

export function EnvironmentPanel() {
  return (
    <>
      <SettingsPanelHeader description="Codex 登录状态和账号信息" title="环境检测" />
      <SettingsList>
        <SettingsRow description="凭据可用于桌面端请求" title="登录状态" action={<span className="text-base font-semibold text-text-strong">已登录</span>} />
        <SettingsRow
          description="本地仅展示，敏感信息不写入日志"
          title="账号"
          action={<span className="truncate text-base font-semibold text-text-strong">jackboox94@gmail.com</span>}
        />
        <SettingsRow description="订阅能力已同步" title="账号类型" action={<span className="text-base font-semibold text-text-strong">plus</span>} />
        <SettingsRow
          description="命令行工具可被调用"
          title="CLI 版本"
          action={<span className="text-base font-semibold text-text-strong">codex-cli 0.118.0</span>}
        />
        <SettingsRow
          description="来自当前 Node 环境"
          title="CLI 路径"
          action={<span className="truncate text-base font-semibold text-text-strong">/Users/mac/.nvm/versions/node/v22.22.0/bin/codex</span>}
        />
      </SettingsList>
    </>
  )
}
