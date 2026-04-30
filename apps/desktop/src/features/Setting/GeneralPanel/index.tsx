import { Code2 } from 'lucide-react'

import { InlineButton, SegmentedControl, SelectLike, SettingsList, SettingsPanelHeader, SettingsRow, ToggleSwitch } from '../SettingPanelPrimitives'

function AppIcon() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-lg bg-background-solid text-text-strong">
      <Code2 className="size-3.5" strokeWidth={1.9} />
    </span>
  )
}

export function GeneralPanel() {
  return (
    <>
      <SettingsPanelHeader description="应用启动、语言和交互偏好" title="通用" />
      <SettingsList>
        <SettingsRow
          action={<SelectLike leading={<AppIcon />} value="VS Code" />}
          description="默认打开文件和文件夹的位置"
          title="默认打开目标"
        />
        <SettingsRow action={<SelectLike value="自动检测" />} description="应用 UI 语言" title="语言" />
        <SettingsRow
          action={<ToggleSwitch />}
          description="关闭主窗口后，仍在 macOS 菜单栏中保留 Codex"
          title="在菜单栏中显示"
        />
        <SettingsRow
          action={
            <div className="flex items-center gap-3">
              <span className="text-base font-medium text-text-muted">禁用</span>
              <InlineButton>设置</InlineButton>
            </div>
          }
          description="为弹出窗口设置全局快捷键。留空则保持关闭。"
          title="弹出窗口快捷键"
        />
        <SettingsRow
          action={<ToggleSwitch />}
          description="在 Codex 运行对话时，让电脑保持唤醒状态"
          title="运行时防止系统休眠"
        />
        <SettingsRow
          action={<ToggleSwitch />}
          description="启用后，长文本提示需按 ⌘ + 回车键发送。"
          title="需按 ⌘ + 回车键发送长文本提示"
        />
        <SettingsRow
          action={<SelectLike value="标准" />}
          description="选择聊天、子智能体和上下文压缩中的推理速度。快速模式会增加套餐用量"
          title="速度"
        />
        <SettingsRow
          action={<SegmentedControl options={['排队', '引导']} value="排队" />}
          description="在 Codex 运行时将后续操作加入队列，或引导当前运行。按 ⌘Enter 可对单条消息执行相反操作"
          title="跟进行为"
        />
        <SettingsRow
          action={<SegmentedControl options={['行内视图', '分离视图']} value="行内视图" />}
          description="尽可能在当前对话中启动 /review，或发起单独的审查对话"
          title="代码审查"
        />
        <SettingsRow action={<ToggleSwitch defaultEnabled />} description="搜索项目文件和已连接应用，建议下一步操作" title="建议提示" />
      </SettingsList>
    </>
  )
}
