import type { MouseEvent } from 'react'
import { useMatches } from 'react-router'

export function AppHeader() {
  const matches = useMatches()
  const activeHandle = [...matches].reverse().map((match) => match.handle).find((handle) => getRouteTitle(handle) || shouldHideRouteTitle(handle))
  const title = getRouteTitle(activeHandle) ?? 'Art Pilot'
  const shouldHideTitle = shouldHideRouteTitle(activeHandle)

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
        {shouldHideTitle ? null : <span>{title}</span>}
      </div>
    </header>
  )
}

function shouldHideRouteTitle(handle: unknown) {
  if (typeof handle !== 'object' || handle === null || !('meta' in handle)) {
    return false
  }

  const meta = handle.meta

  return typeof meta === 'object'
    && meta !== null
    && 'hideHeaderTitle' in meta
    && meta.hideHeaderTitle === true
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
