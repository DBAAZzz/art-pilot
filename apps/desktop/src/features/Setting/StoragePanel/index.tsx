import type { AppSettings, CodexImageCleanupPolicy } from '@art-pilot/shared'
import { FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/Select'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useApiRequest } from '@/hooks/useApiRequest'
import { getErrorMessage, useLoadingState } from '@/hooks/useLoadingState'
import { SettingsList, SettingsPanelHeader, SettingsRow } from '../components/SettingPanelPrimitives'

const cleanupOptions: Array<{
  label: string
  value: CodexImageCleanupPolicy
}> = [
  {
    label: '不删除',
    value: 'never',
  },
  {
    label: '导入后删除',
    value: 'after-import',
  },
]

const cleanupOptionLabelMap = new Map(
  cleanupOptions.map((option) => [option.value, option.label]),
)

export function StoragePanel() {
  const getSettings = useCallback(() => window.api.getSettings(), [])
  const {
    data: settings,
    error: settingsError,
    execute: fetchSettings,
    loading,
    setData: setSettings,
  } = useApiRequest(getSettings, {
    initialData: null as AppSettings | null,
    initialLoading: true,
  })
  const [imageLibraryPath, setImageLibraryPath] = useState('')
  const [codexImageCleanup, setCodexImageCleanup] = useState<CodexImageCleanupPolicy>('never')
  const updateState = useLoadingState()
  const [statusText, setStatusText] = useState<string | null>(null)

  useEffect(() => {
    async function loadSettings() {
      setStatusText(null)

      // 设置真实来源是主进程 SQLite；renderer 只保留当前表单草稿。
      const result = await fetchSettings()

      if (result) {
        setImageLibraryPath(result.imageLibraryPath)
        setCodexImageCleanup(result.codexImageCleanup)
      }
    }

    void loadSettings()
  }, [fetchSettings])

  async function selectLibraryFolder() {
    setStatusText(null)

    try {
      // 系统目录选择器只能由主进程打开；选择后立即写入设置，不再需要二次确认。
      const selectedPath = await window.api.selectImageLibraryFolder(imageLibraryPath)

      if (selectedPath) {
        await updateImageLibraryPath(selectedPath)
      }
    } catch (error) {
      setStatusText(getErrorMessage(error))
    }
  }

  async function updateImageLibraryPath(nextPath: string) {
    const trimmedPath = nextPath.trim()

    if (!settings || updateState.loading || !trimmedPath || trimmedPath === settings.imageLibraryPath) {
      setImageLibraryPath(settings?.imageLibraryPath ?? nextPath)
      return
    }

    updateState.startLoading()
    setStatusText(null)

    try {
      // 主进程会展开 ~ 并返回规范化后的绝对路径，renderer 用返回值回填输入框。
      const nextSettings = await window.api.updateSettings({ imageLibraryPath: trimmedPath })
      setSettings(nextSettings)
      setImageLibraryPath(nextSettings.imageLibraryPath)
    } catch (error) {
      setImageLibraryPath(settings.imageLibraryPath)
      updateState.failLoading(error)
      setStatusText(getErrorMessage(error))
      return
    } finally {
      updateState.stopLoading()
    }
  }

  async function updateCodexImageCleanup(nextPolicy: CodexImageCleanupPolicy) {
    if (!settings || nextPolicy === settings.codexImageCleanup) {
      setCodexImageCleanup(settings?.codexImageCleanup ?? nextPolicy)
      return
    }

    const previousSettings = settings
    const previousPolicy = previousSettings.codexImageCleanup

    // 下拉框使用乐观更新：先让 UI 稳定显示新值，后台写库；失败时再回滚。
    setCodexImageCleanup(nextPolicy)
    setSettings({
      ...previousSettings,
      codexImageCleanup: nextPolicy,
    })
    setStatusText(null)

    try {
      // 清理策略是单项配置，选择后直接写库，后续导入图片立即使用新策略。
      const nextSettings = await window.api.updateSettings({ codexImageCleanup: nextPolicy })
      setSettings(nextSettings)
    } catch (error) {
      setSettings(previousSettings)
      setCodexImageCleanup(previousPolicy)
      setStatusText(getErrorMessage(error))
    }
  }

  async function openLibraryFolder() {
    setStatusText(null)

    try {
      // 打开当前已保存的图片库目录，主进程会在目录不存在时先创建。
      await window.api.openImageLibraryFolder()
    } catch (error) {
      setStatusText(getErrorMessage(error))
    }
  }

  return (
    <>
      <SettingsPanelHeader description="图片库路径和 Codex 临时产物清理策略" title="数据存储" />
      {statusText || settingsError ? <p className="mb-3 text-base text-text-muted">{statusText ?? settingsError}</p> : null}
      <SettingsList>
        <SettingsRow
          action={
            <div className="flex w-full max-w-[520px] items-center gap-2">
              <Input
                className="flex-1"
                disabled={loading || updateState.loading}
                onBlur={() => void updateImageLibraryPath(imageLibraryPath)}
                onChange={(event) => setImageLibraryPath(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  }
                }}
                value={imageLibraryPath}
              />
              <Button disabled={loading || updateState.loading} onClick={selectLibraryFolder}>
                <FolderOpen className="size-4" strokeWidth={1.9} />
              </Button>
              <Button disabled={loading} onClick={openLibraryFolder}>
                打开
              </Button>
            </div>
          }
          title="图片库目录"
        />
        <SettingsRow
          action={
            <Select
              disabled={loading}
              value={codexImageCleanup}
              onValueChange={(value) => void updateCodexImageCleanup(value as CodexImageCleanupPolicy)}
            >
              <SelectTrigger className="w-[180px] justify-between gap-2 bg-fill-hover pl-3 text-base font-normal leading-5">
                <span className="min-w-0 flex-1 truncate text-left text-base font-normal leading-5">{cleanupOptionLabelMap.get(codexImageCleanup) ?? codexImageCleanup}</span>
              </SelectTrigger>
              <SelectContent className="min-w-[180px]">
                {cleanupOptions.map((option) => (
                  <SelectItem className="text-base font-normal leading-5" key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          title="Codex 原图清理"
        />
      </SettingsList>
    </>
  )
}
