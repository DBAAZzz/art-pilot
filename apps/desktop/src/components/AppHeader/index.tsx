import type { MouseEvent } from 'react'
import { useLocation } from 'react-router'

export function AppHeader() {
  const location = useLocation()
  const isSettings = location.pathname === '/settings'

  const handleDoubleClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target

    if (target instanceof HTMLElement && target.closest('[data-window-drag-ignore]')) {
      return
    }

    void window.api.toggleWindowMaximize()
  }

  return (
    <header
      className="window-drag-region absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background-solid px-6 shadow-app-header-bottom"
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex items-center gap-2.5 text-[15px] font-semibold text-text-strong">
        <span>{isSettings ? '设置' : '创作'}</span>
      </div>
    </header>
  )
}
