import { Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router'

import { SidebarNavButton } from './SidebarNavButton'
import { appNavigationItems } from '@/router/navigation'

const SIDEBAR_WIDTH_STORAGE_KEY = 'art-pilot:sidebar-width'
const DEFAULT_SIDEBAR_WIDTH = 238
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 320

export function AppSidebar() {
  const [width, setWidth] = useState(() => readStoredSidebarWidth())
  const resizeStateRef = useRef<{
    startX: number
    startWidth: number
  } | null>(null)

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))
  }, [width])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const resizeState = resizeStateRef.current

      if (!resizeState) {
        return
      }

      setWidth(clampSidebarWidth(resizeState.startWidth + event.clientX - resizeState.startX))
    }

    const handlePointerUp = () => {
      resizeStateRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    resizeStateRef.current = {
      startX: event.clientX,
      startWidth: width,
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const resetWidth = () => {
    setWidth(DEFAULT_SIDEBAR_WIDTH)
  }

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setWidth((currentWidth) => clampSidebarWidth(currentWidth - 8))
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setWidth((currentWidth) => clampSidebarWidth(currentWidth + 8))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setWidth(MIN_SIDEBAR_WIDTH)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setWidth(MAX_SIDEBAR_WIDTH)
    }
  }

  return (
    <aside
      className='relative flex shrink-0 flex-col bg-background-subtle px-2 pb-4 pt-14'
      style={{ width }}
    >
      <nav aria-label='主导航' className='flex min-w-0 flex-col gap-1'>
        {appNavigationItems.map((item) => (
          <SidebarNavButton key={item.label} item={item} />
        ))}
      </nav>

      <div className='mt-auto border-slate-200/70'>
        <NavLink
          className={({ isActive }) =>
            [
              'group flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 text-left text-base font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4655f4]/20',
              isActive
                ? 'bg-fill-hover text-text-strong'
                : 'text-text-muted hover:bg-fill-hover hover:text-text-strong',
            ].join(' ')
          }
          to='/settings'
        >
          <Settings
            className='size-4 shrink-0 text-current transition-colors'
            strokeWidth={2}
          />
          <span className='min-w-0 flex-1 truncate text-base'>设置</span>
        </NavLink>
      </div>

      <div
        aria-label='调整侧边栏宽度'
        aria-orientation='vertical'
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuenow={width}
        className='group absolute top-0 z-30 flex h-full w-2 cursor-col-resize items-stretch justify-center'
        onDoubleClick={resetWidth}
        onKeyDown={handleResizeKeyDown}
        onPointerDown={startResize}
        role='separator'
        style={{ right: -4 }}
        tabIndex={0}
        title='拖动调整宽度，双击恢复默认'
      >
        <span className='block h-full w-px bg-transparent transition-colors' />
      </div>
    </aside>
  )
}

function readStoredSidebarWidth() {
  const storedValue = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
  const parsedValue = storedValue ? Number(storedValue) : DEFAULT_SIDEBAR_WIDTH

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_SIDEBAR_WIDTH
  }

  return clampSidebarWidth(parsedValue)
}

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)))
}
