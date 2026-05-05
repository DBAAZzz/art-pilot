import { Settings } from 'lucide-react'
import { NavLink } from 'react-router'

import { SidebarNavButton } from './SidebarNavButton'
import { appNavigationItems } from '@/router/navigation'

export function AppSidebar() {
  return (
    <aside className='flex w-[238px] shrink-0 flex-col border-r border-slate-200/70 bg-background-subtle px-2 pb-4 pt-14'>
      <nav aria-label='主导航' className='flex flex-col gap-1'>
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
    </aside>
  )
}
