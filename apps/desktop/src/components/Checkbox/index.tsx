import { Check } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type CheckboxProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'checked' | 'onChange' | 'role'> & {
  checked: boolean
  label?: string
  onCheckedChange: (checked: boolean) => void
}

export function Checkbox({
  checked,
  className,
  disabled,
  label,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  return (
    <button
      aria-checked={checked}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-lg text-base font-semibold text-text-strong transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      disabled={disabled}
      role="checkbox"
      type="button"
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-md border transition-colors',
          checked ? 'border-text-strong bg-text-strong text-background-solid' : 'border-border bg-fill text-background-solid',
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={2.2} /> : null}
      </span>
      {label ? <span>{label}</span> : null}
    </button>
  )
}
