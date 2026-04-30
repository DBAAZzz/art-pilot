import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

export function SettingsList({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background-solid">
      <div className="divide-y divide-separator-subtle">{children}</div>
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
  description: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,480px)] items-center gap-6 py-3 px-4">
      <div className="min-w-80">
        <div className="text-base font-semibold text-text-strong">{title}</div>
        <div className="mt-1 text-base leading-5 text-text-muted">{description}</div>
      </div>
      {action ? <div className="flex min-w-0 justify-end">{action}</div> : null}
    </div>
  )
}

export function SelectLike({ value, leading }: { value: string; leading?: ReactNode }) {
  return (
    <button
      className="flex h-9 w-full max-w-[320px] cursor-pointer items-center justify-between gap-3 rounded-lg bg-fill-hover px-3 text-left text-base font-medium text-text-strong transition-colors hover:bg-fill-active"
      type="button"
    >
      <span className="flex min-w-0 items-center gap-2">
        {leading}
        <span className="truncate">{value}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-text-muted" strokeWidth={1.9} />
    </button>
  )
}

export function ToggleSwitch({ defaultEnabled = false }: { defaultEnabled?: boolean }) {
  const [enabled, setEnabled] = useState(defaultEnabled)

  return (
    <button
      aria-pressed={enabled}
      className={cn(
        'relative h-6 w-11 cursor-pointer rounded-full transition-colors active:translate-y-px',
        enabled ? 'bg-text-strong' : 'bg-fill-active',
      )}
      onClick={() => setEnabled((current) => !current)}
      type="button"
    >
      <span
        className={cn(
          'absolute top-1 size-4 rounded-full bg-background-solid transition-transform',
          enabled ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

export function InlineButton({ children }: { children: ReactNode }) {
  return (
    <button
      className="h-9 cursor-pointer rounded-lg bg-fill-hover px-3 text-base font-semibold text-text-strong transition-colors hover:bg-fill-active active:translate-y-px"
      type="button"
    >
      {children}
    </button>
  )
}

export function SegmentedControl({
  options,
  value,
}: {
  options: string[]
  value: string
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-fill px-1">
      {options.map((option) => (
        <button
          className={cn(
            'h-8 cursor-pointer rounded-lg px-3 text-base font-medium transition-colors active:translate-y-px',
            option === value ? 'bg-fill-hover text-text-strong' : 'text-text-muted hover:bg-fill-hover hover:text-text-strong',
          )}
          key={option}
          type="button"
        >
          {option}
        </button>
      ))}
    </div>
  )
}
