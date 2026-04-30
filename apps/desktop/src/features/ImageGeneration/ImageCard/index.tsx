import { Bookmark, Check, MoreHorizontal, RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Landscape } from '../Landscape'
import type { LandscapeTone } from '../types'

export function ImageCard({ tone, index, active }: { tone: LandscapeTone; index: number; active?: boolean }) {
  return (
    <article
      className={cn(
        'overflow-hidden rounded-[10px] border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition',
        active ? 'border-[#4655f4]' : 'border-slate-200/80',
      )}
    >
      <div className="relative aspect-[1.32] overflow-hidden bg-slate-100">
        <Landscape tone={tone} compact />
        <span className="absolute left-2.5 top-2.5 flex size-6 items-center justify-center rounded-[7px] bg-slate-900/62 text-xs font-semibold text-white shadow-sm">
          {index}
        </span>
        {active ? (
          <span className="absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-[7px] bg-[#4655f4] text-white shadow-sm">
            <Check className="size-3.5" />
          </span>
        ) : null}
      </div>
      <div className="flex h-9 items-center justify-between px-2.5 text-text-muted">
        <Bookmark className="size-4" />
        <div className="flex items-center gap-3">
          <RefreshCw className="size-3.5" />
          <MoreHorizontal className="size-4" />
        </div>
      </div>
    </article>
  )
}
