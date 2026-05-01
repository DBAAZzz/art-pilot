import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

export function OptionGroup({
  activeIndex,
  children,
  label,
  optionCount,
}: {
  activeIndex: number
  children: React.ReactNode
  label: string
  optionCount: number
}) {
  const indicatorStyle = {
    transform: `translateX(${activeIndex * 100}%)`,
    width: `calc((100% - 4px) / ${optionCount})`,
  } satisfies CSSProperties

  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs font-medium text-text-muted">{label}</div>
      <div className="relative h-8 overflow-hidden rounded-xl border border-border bg-background-subtle p-0.5">
        <div
          className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-xl bg-background-solid transition-transform duration-200 ease-out"
          style={indicatorStyle}
        />
        <div className="relative z-10 grid h-full grid-flow-col auto-cols-fr">
          {children}
        </div>
      </div>
    </div>
  )
}

export function SegmentButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'h-full cursor-pointer rounded-xl px-2 text-xs transition-colors',
        active
          ? 'font-medium text-text-strong'
          : 'text-text-muted hover:bg-fill-hover hover:text-text-strong',
      )}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}
