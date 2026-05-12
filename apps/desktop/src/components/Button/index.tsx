import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'

import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'ghost'
type ButtonDisplay = 'inline' | 'block'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  display?: ButtonDisplay
}

const variantClassNames: Record<ButtonVariant, string> = {
  default: 'bg-fill-hover text-text-strong hover:bg-fill-active',
  ghost: 'text-text-muted hover:bg-fill-hover hover:text-text-strong',
}

const displayClassNames: Record<ButtonDisplay, string> = {
  inline: 'inline-flex',
  block: 'flex w-full',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  children,
  className,
  display = 'inline',
  style,
  type = 'button',
  variant = 'default',
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        displayClassNames[display],
        'h-8 cursor-pointer items-center justify-center rounded-lg px-3 text-base font-semibold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50',
        variantClassNames[variant],
        className,
      )}
      style={{
        fontSize: 'var(--text-base)',
        lineHeight: 'var(--text-base--line-height)',
        ...style,
      }}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
})
