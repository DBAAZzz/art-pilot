import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'
import type { LandscapeTone } from '../types'

export function Landscape({ tone, compact = false }: { tone: LandscapeTone; compact?: boolean }) {
  const style = {
    '--sky': tone.sky,
    '--dusk': tone.dusk,
    '--ridge': tone.ridge,
    '--sun': tone.sun,
  } as CSSProperties

  return (
    <div
      aria-label="雪山湖泊日出生成图"
      className="relative h-full w-full overflow-hidden"
      role="img"
      style={style}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,var(--sky)_0%,var(--dusk)_47%,#45516a_48%,#172235_100%)]" />
      <div className="absolute left-1/2 top-[35%] size-20 -translate-x-1/2 rounded-full bg-[var(--sun)] blur-[1px]" />
      <div className="absolute left-0 top-[38%] h-[31%] w-[55%] bg-[var(--ridge)] [clip-path:polygon(0_100%,18%_36%,33%_75%,53%_18%,72%_83%,100%_46%,100%_100%)]" />
      <div className="absolute right-0 top-[30%] h-[39%] w-[67%] bg-[#202a3e] [clip-path:polygon(0_100%,12%_57%,25%_72%,43%_12%,58%_68%,77%_28%,100%_90%,100%_100%)]" />
      <div className="absolute left-[11%] top-[46%] h-[12%] w-[78%] bg-white/65 blur-[10px]" />
      <div className="absolute bottom-0 left-0 h-[48%] w-full bg-[linear-gradient(180deg,rgba(255,209,132,0.42),rgba(27,38,59,0.92))]" />
      <div className="absolute bottom-[11%] left-[12%] h-[9%] w-[30%] rounded-[50%] bg-slate-950/45 blur-[2px]" />
      <div className="absolute bottom-[18%] right-[7%] h-[7%] w-[24%] rounded-[50%] bg-slate-950/35 blur-[2px]" />
      <div
        className={cn(
          'absolute left-[8%] right-[8%] h-px bg-white/70',
          compact ? 'bottom-[31%]' : 'bottom-[34%]',
        )}
      />
    </div>
  )
}
