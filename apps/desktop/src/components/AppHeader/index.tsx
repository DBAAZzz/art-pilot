import type { MouseEvent } from 'react'
import { useMatches } from 'react-router'

export function AppHeader() {
  const matches = useMatches()
  const title = [...matches].reverse().map((match) => getRouteTitle(match.handle)).find(Boolean) ?? 'Art Pilot'

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
        <span>{title}</span>
      </div>
    </header>
  )
}

function getRouteTitle(handle: unknown) {
  if (typeof handle !== 'object' || handle === null || !('meta' in handle)) {
    return undefined
  }

  const meta = handle.meta

  if (typeof meta !== 'object' || meta === null || !('title' in meta)) {
    return undefined
  }

  return typeof meta.title === 'string' ? meta.title : undefined
}
