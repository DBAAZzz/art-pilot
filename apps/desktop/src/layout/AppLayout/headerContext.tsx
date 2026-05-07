import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'

export type AppHeaderOptions = {
  left?: ReactNode
  right?: ReactNode
  showBackButton?: boolean
  onBack?: () => void
}

type AppHeaderContextValue = {
  headerOptions: AppHeaderOptions
  setHeaderOptions: (options: AppHeaderOptions) => void
}

export const AppHeaderContext = createContext<AppHeaderContextValue | null>(null)

export function useAppHeader() {
  const context = useContext(AppHeaderContext)

  if (!context) {
    throw new Error('useAppHeader must be used inside AppLayout')
  }

  return context
}
