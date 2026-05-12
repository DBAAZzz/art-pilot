import type { ReactNode } from 'react'

export function SettingsList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background-solid">
      <div className="divide-y-[0.5px] divide-separator-subtle">{children}</div>
    </div>
  )
}

export function SettingsPanelHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-5">
      <h1 className="text-title font-semibold text-text-strong">{title}</h1>
      <p className="mt-1 text-base leading-5 text-text-muted">{description}</p>
    </div>
  )
}

export function SettingsRow({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="grid min-h-14 grid-cols-[minmax(0,1fr)_minmax(180px,480px)] items-center gap-6 py-3 px-4">
      <div className="min-w-80">
        <div className="text-base text-text-strong">{title}</div>
        <div className="mt-1 text-base leading-5 text-text-muted">{description}</div>
      </div>
      {action ? <div className="flex min-w-0 justify-end">{action}</div> : null}
    </div>
  )
}
