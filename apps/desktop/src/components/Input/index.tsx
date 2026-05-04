import type { InputHTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({
  className,
  style,
  ...props
}: InputProps) {
  return (
    <input
      className={cn(
        'h-8 min-w-0 rounded-lg border border-border bg-fill px-3 text-base font-medium text-text-strong outline-none transition-colors placeholder:text-text-muted focus:border-border-hover disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      style={{
        fontSize: 'var(--text-base)',
        lineHeight: 'var(--text-base--line-height)',
        ...style,
      }}
      {...props}
    />
  )
}
