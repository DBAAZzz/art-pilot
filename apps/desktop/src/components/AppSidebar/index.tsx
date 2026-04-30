import { Folder, ImageIcon, PenLine, Settings, Sparkles } from 'lucide-react'
import { NavLink } from 'react-router'

import { SidebarNavButton } from './SidebarNavButton'
import type { SidebarNavItem } from './SidebarNavButton'

const navItems: SidebarNavItem[] = [
  { label: '创作', icon: Sparkles, to: '/' },
  { label: '素材库', icon: ImageIcon },
  { label: '归档管理', icon: Folder },
  { label: 'Prompt 管理', icon: PenLine },
  { label: '模型与设置', icon: Settings },
]

export function AppSidebar() {
  return (
    <aside className='flex w-[238px] shrink-0 flex-col border-r border-slate-200/70 bg-background-subtle px-2 pb-4 pt-14'>
      <nav aria-label='主导航' className='flex flex-col gap-1'>
        {navItems.map((item) => (
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
            className='size-3 shrink-0 text-current transition-colors'
            strokeWidth={1.9}
          />
          <span className='min-w-0 flex-1 truncate text-base'>设置</span>
        </NavLink>
      </div>
    </aside>
  )
}
