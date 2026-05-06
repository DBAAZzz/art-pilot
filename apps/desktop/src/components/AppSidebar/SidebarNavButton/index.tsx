import type { LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

export type SidebarNavItem = {
  label: string
  icon: LucideIcon
  to?: string
  active?: boolean
}

export function SidebarNavButton({ item }: { item: SidebarNavItem }) {
  const Icon = item.icon
  const className = ({ isActive }: { isActive?: boolean } = {}) =>
    cn(
      'group flex h-[36px] items-center gap-2 rounded-lg px-2.5 text-left text-[12px] font-medium leading-none transition-colors',
      item.active || isActive
        ? 'bg-fill-hover text-text-strong'
        : 'text-text-muted hover:bg-fill-hover hover:text-text-strong',
    )

  const iconClassName = ({ isActive }: { isActive?: boolean } = {}) =>
    cn('size-4 shrink-0', item.active || isActive ? 'text-text-strong' : 'text-text-muted group-hover:text-text-strong')

  const content = (isActive?: boolean) => (
    <>
      <Icon className={iconClassName({ isActive })} strokeWidth={1.8} />
      <span className="min-w-0 flex-1 font-mono truncate text-base">{item.label}</span>
    </>
  )

  if (item.to) {
    return (
      <NavLink className={({ isActive }) => className({ isActive })} end={item.to === '/'} to={item.to}>
        {({ isActive }) => content(isActive)}
      </NavLink>
    )
  }

  return (
    <button className={className()} type="button">
      {content()}
    </button>
  )
}
