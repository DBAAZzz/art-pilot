import { ArrowLeft } from 'lucide-react'
import type { MouseEvent } from 'react'
import type { ReactNode } from 'react'
import { useMatches, useNavigate } from 'react-router'

type AppHeaderProps = {
  left?: ReactNode
  right?: ReactNode
  showBackButton?: boolean
  onBack?: () => void
}

export function AppHeader({
  left,
  right,
  showBackButton = false,
  onBack,
}: AppHeaderProps) {
  const matches = useMatches()
  const navigate = useNavigate()
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

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }

    void navigate(-1)
  }

  return (
    <header
      className="window-drag-region absolute inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background-solid px-6 shadow-app-header-bottom"
      onDoubleClick={handleDoubleClick}
    >
      <div className="flex min-w-0 items-center gap-2.5 text-base font-semibold text-text-strong">
        {left ? (
          <div className="window-no-drag" data-window-drag-ignore>{left}</div>
        ) : showBackButton ? (
          <button
            aria-label="返回上一层"
            className="window-no-drag inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
            data-window-drag-ignore
            type="button"
            onClick={handleBack}
          >
            <ArrowLeft className="size-4" strokeWidth={1.9} />
          </button>
        ) : null}
        {shouldHideTitle ? null : <span>{title}</span>}
      </div>
      {right ? (
        <div className="window-no-drag flex shrink-0 items-center gap-2" data-window-drag-ignore>
          {right}
        </div>
      ) : null}
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
