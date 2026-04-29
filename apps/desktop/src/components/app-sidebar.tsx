import {
  Boxes,
  ChevronDown,
  Folder,
  ImageIcon,
  PenLine,
  Settings,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type SidebarNavItem = {
  label: string
  icon: LucideIcon
  active?: boolean
}

const navItems: SidebarNavItem[] = [
  { label: '创作', icon: Sparkles, active: true },
  { label: '素材库', icon: ImageIcon },
  { label: '归档管理', icon: Folder },
  { label: 'Prompt 管理', icon: PenLine },
  { label: '模型与设置', icon: Settings },
]

const memoryIconLightUrl = new URL('../assets/icons/memory_icon_light.svg', import.meta.url).href

export function AppSidebar() {
  return (
    <aside className="flex w-[238px] shrink-0 flex-col border-r border-slate-200/70 bg-[#f8f8fa]/95 px-4 pb-4 pt-14">
      <nav aria-label="主导航" className="flex flex-col gap-1">
        {navItems.map((item) => (
          <SidebarNavButton key={item.label} item={item} />
        ))}
      </nav>

      <Separator className="my-6 bg-slate-200/70" />

      <div className="mt-auto flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-[10px] border border-slate-200/80 bg-white/90 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-8">
              <AvatarImage src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=96&q=80" />
              <AvatarFallback>ZZ</AvatarFallback>
            </Avatar>
            <span className="truncate text-[11.5px] font-medium text-slate-700">Zack Zhang</span>
            <ChevronDown className="size-3.5 shrink-0 text-slate-500" />
          </div>
          <Badge className="h-5 rounded-full bg-amber-100 px-2 text-[10.5px] font-medium text-amber-700 hover:bg-amber-100">
            Pro
          </Badge>
        </div>

        <div className="flex justify-around text-slate-500">
          <Settings className="size-4" strokeWidth={1.8} />
          <Boxes className="size-4" strokeWidth={1.8} />
        </div>
      </div>
    </aside>
  )
}

function SidebarNavButton({ item }: { item: SidebarNavItem }) {
  const Icon = item.icon

  return (
    <button
      className={cn(
        'group flex h-8 items-center gap-2 rounded-[8px] px-2.5 text-left text-[12px] font-medium leading-none tracking-[-0.005em] transition-colors',
        item.active
          ? 'bg-[#edf0ff] text-[#4655f4] shadow-[inset_0_0_0_1px_rgba(79,90,247,0.035)]'
          : 'text-slate-600 hover:bg-white/90 hover:text-slate-950',
      )}
      type="button"
    >
      <Icon
        className={cn('size-3 shrink-0', item.active ? 'text-[#4655f4]' : 'text-slate-500')}
        strokeWidth={1.9}
      />
      <span className="min-w-0 text-[13px] flex-1 truncate">{item.label}</span>
    </button>
  )
}
