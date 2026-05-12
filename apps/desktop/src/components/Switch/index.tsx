import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'checked' | 'onChange' | 'role'> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function Switch({
  checked,
  className,
  disabled,
  onCheckedChange,
  ...props
}: SwitchProps) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        'inline-flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-accent bg-accent' : 'border-border bg-fill-hover',
        className,
      )}
      disabled={disabled}
      role="switch"
      type="button"
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      <span
        className={cn(
          'size-5 rounded-full bg-background-solid transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  )
}
