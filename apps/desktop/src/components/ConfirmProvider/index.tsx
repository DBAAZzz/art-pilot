import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { ConfirmDialogVariant } from '@/components/ConfirmDialog'

export type ConfirmOptions = {
  cancelLabel?: string
  confirmLabel?: string
  description?: string
  priority?: number
  title: string
  variant?: ConfirmDialogVariant
}

type ConfirmRequest = ConfirmOptions & {
  sequence: number
  resolve: (confirmed: boolean) => void
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const sequenceRef = useRef(0)
  const [requests, setRequests] = useState<ConfirmRequest[]>([])
  const activeRequest = requests[0] ?? null

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const request: ConfirmRequest = {
        ...options,
        priority: options.priority ?? 0,
        resolve,
        sequence: sequenceRef.current,
      }

      sequenceRef.current += 1

      setRequests((currentRequests) => {
        if (currentRequests.length === 0) {
          return [request]
        }

        const [activeRequest, ...queuedRequests] = currentRequests

        return [activeRequest, ...[...queuedRequests, request].sort(compareConfirmRequests)]
      })
    })
  }, [])

  const settleActiveRequest = useCallback((confirmed: boolean) => {
    activeRequest?.resolve(confirmed)
    setRequests((currentRequests) => {
      const [, ...remainingRequests] = currentRequests

      return remainingRequests
    })
  }, [activeRequest])

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {activeRequest ? (
        <ConfirmDialog
          cancelLabel={activeRequest.cancelLabel}
          confirmLabel={activeRequest.confirmLabel}
          description={activeRequest.description}
          open
          title={activeRequest.title}
          variant={activeRequest.variant}
          onCancel={() => settleActiveRequest(false)}
          onConfirm={() => settleActiveRequest(true)}
        />
      ) : null}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)

  if (!context) {
    throw new Error('useConfirm must be used within ConfirmProvider')
  }

  return context.confirm
}

function compareConfirmRequests(a: ConfirmRequest, b: ConfirmRequest) {
  const priorityDifference = (b.priority ?? 0) - (a.priority ?? 0)

  return priorityDifference === 0 ? a.sequence - b.sequence : priorityDifference
}
