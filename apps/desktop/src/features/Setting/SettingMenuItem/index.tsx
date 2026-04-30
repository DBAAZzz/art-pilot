import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export type SettingMenuItemTab = {
  label: string
  description?: string
  icon: LucideIcon
}

export function SettingMenuItem({
  active,
  tab,
  onClick,
}: {
  active: boolean
  tab: SettingMenuItemTab
  onClick: () => void
}) {
  const Icon = tab.icon

  return (
    <button
      className={cn(
        'group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-[background-color,color,transform] duration-50 active:translate-y-px',
        active ? 'bg-fill-hover text-text-strong' : 'text-text-muted hover:bg-fill-hover hover:text-text-strong',
      )}
      onClick={onClick}
      type="button"
    >
      <Icon
        className={cn('size-4 shrink-0', active ? 'text-text-strong' : 'text-text-muted group-hover:text-text-strong')}
        strokeWidth={1.9}
      />
      <span className="min-w-0">
        <span className={cn('block truncate text-base leading-5', active ? 'text-text-strong font-semibold' : 'text-text-muted group-hover:text-text-strong')}>
          {tab.label}
        </span>
      </span>
    </button>
  )
}
