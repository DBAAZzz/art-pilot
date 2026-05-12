import { AlertTriangle, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/Button'
import { cn } from '@/lib/utils'

export type ConfirmDialogVariant = 'default' | 'danger'

export type ConfirmDialogProps = {
  cancelLabel?: string
  confirmLabel?: string
  description?: string
  open: boolean
  title: string
  variant?: ConfirmDialogVariant
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  cancelLabel = '取消',
  confirmLabel = '确定',
  description,
  open,
  title,
  variant = 'default',
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frameId = window.requestAnimationFrame(() => {
      confirmButtonRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      previousActiveElement?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel, open])

  if (!open) {
    return null
  }

  return createPortal(
    <div
      aria-modal="true"
      className="window-no-drag fixed inset-0 z-[1100] flex items-center justify-center bg-text-strong/35 px-6 py-6 backdrop-blur-[2px]"
      role="dialog"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background-solid p-5 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
              variant === 'danger' ? 'bg-text-error/10 text-text-error' : 'bg-fill-hover text-text-strong',
            )}
          >
            <AlertTriangle className="size-4" strokeWidth={1.8} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-text-strong">{title}</h2>
            {description ? (
              <p className="mt-1.5 text-base leading-5 text-text-muted">{description}</p>
            ) : null}
          </div>

          <button
            aria-label="关闭"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
            type="button"
            onClick={onCancel}
          >
            <X className="size-3.5" strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            className={cn(
              variant === 'danger'
                ? 'bg-text-error text-background-solid hover:bg-text-error/90'
                : 'bg-text-strong text-background-solid hover:bg-text-muted',
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
