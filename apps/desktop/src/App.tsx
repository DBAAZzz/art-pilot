import {
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Grid2X2,
  MoreHorizontal,
  PenLine,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Wand2,
} from 'lucide-react'
import type { CSSProperties } from 'react'

import { AppSidebar } from '@/components/app-sidebar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const gallery = [
  { sky: '#a8b9df', dusk: '#ffd08a', ridge: '#38445c', sun: '#ffe7a6' },
  { sky: '#8fa9c6', dusk: '#ffc071', ridge: '#27374f', sun: '#ffd184' },
  { sky: '#9e9ad0', dusk: '#f0a66d', ridge: '#2d334b', sun: '#ffc47c' },
  { sky: '#b7c0d8', dusk: '#ffc989', ridge: '#3c465b', sun: '#ffe0a0' },
  { sky: '#8ea3bd', dusk: '#f3a35e', ridge: '#2f3951', sun: '#ffd29a' },
  { sky: '#9daed0', dusk: '#f8bd76', ridge: '#36405a', sun: '#ffdc9a' },
  { sky: '#bac4dc', dusk: '#f5b86d', ridge: '#313a55', sun: '#ffd690' },
  { sky: '#a7b5ce', dusk: '#ffc17f', ridge: '#3b455e', sun: '#ffe0a9' },
]

const promptText =
  '日出的分的雪山湖泊，远处有雾气，湖面反射着金色的阳光，8k 超清，电影级光影，广角镜头'

function App() {
  return (
    <main className="h-screen overflow-hidden bg-[#f7f7f8] text-slate-900 antialiased">
      <div className="flex h-screen w-screen overflow-hidden bg-[#f7f7f8]">
        <AppSidebar />
        <section className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#fbfbfc_0%,#f6f7f9_100%)]">
          <Header />
          <div className="grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-4 px-6 pb-5">
            <ControlPanel />
            <Workspace />
          </div>
        </section>
      </div>
    </main>
  )
}

function Header() {
  return (
    <header className="flex h-[70px] items-center justify-between px-6">
      <div className="flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.01em]">
        <span>创作</span>
        <span className="text-slate-300">/</span>
        <span>Image Gen</span>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" className="h-9 rounded-[10px] border-slate-200/80 bg-white/80 px-4 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          批量操作
        </Button>
        <Button variant="outline" size="icon" className="relative rounded-[10px] border-slate-200/80 bg-white/80 text-[#4655f4] shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Grid2X2 className="size-4" />
        </Button>
        <Button variant="outline" size="icon" className="relative rounded-[10px] border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <Bell className="size-4" />
          <span className="absolute -right-0.5 -top-1 size-2.5 rounded-full bg-[#4655f4]" />
        </Button>
      </div>
    </header>
  )
}

function ControlPanel() {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card className="rounded-[12px] border-slate-200/80 bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardContent className="flex flex-col gap-2.5 p-3.5">
          <label className="text-[13px] font-medium text-slate-600">Prompt</label>
          <div className="relative">
            <Textarea
              readOnly
              value={promptText}
              className="h-[132px] resize-none rounded-[10px] border-slate-200/80 bg-white p-3.5 pr-4 text-[13px] leading-5 text-slate-700 shadow-none focus-visible:ring-indigo-200"
            />
            <span className="absolute bottom-2.5 left-3.5 text-[11px] text-slate-400">36 / 2000</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-8 gap-1.5 rounded-[8px] border-slate-200/80 bg-white px-2.5 text-xs font-medium text-slate-600">
              <Wand2 className="size-3.5" />
              提示词优化
            </Button>
            <Button variant="outline" className="h-8 gap-1.5 rounded-[8px] border-slate-200/80 bg-white px-2.5 text-xs font-medium text-slate-600">
              <Sparkles className="size-3.5" />
              随机提示词
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[12px] border-slate-200/80 bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardContent className="flex flex-col gap-4 p-3.5">
          <div className="text-[13px] font-semibold text-slate-800">模型与设置</div>
          <SettingSelect label="模型" value="GPT-4o Image" />
          <SettingSelect label="尺寸" value="4:3 (1600×1200)" />
          <SettingSelect label="质量" value="高质量" />
          <SettingSelect label="风格" value="写实照片" />
          <button className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <ChevronRight className="size-3.5" />
            高级设置
            <ChevronDown className="size-3.5" />
          </button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-[1fr_56px] gap-2">
        <Button className="h-12 rounded-[10px] bg-[#3f49f5] text-sm font-semibold shadow-[0_10px_20px_rgba(63,73,245,0.18)] hover:bg-[#3842df]">
          生成（8）
        </Button>
        <Button variant="outline" className="h-12 rounded-[10px] border-slate-200/70 bg-white/70 text-slate-600">
          <SlidersHorizontal className="size-4.5" />
        </Button>
      </div>
    </div>
  )
}

function SettingSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2.5">
      <span className="text-[13px] font-medium text-slate-600">{label}</span>
      <Select defaultValue={value}>
        <SelectTrigger className="h-8 w-full rounded-[9px] border-slate-200/80 bg-white px-3 text-xs text-slate-700 shadow-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={value}>{value}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function Workspace() {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <Card className="rounded-[12px] border-slate-200/80 bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <CardContent className="p-3.5">
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-5">
            <div>
              <div className="mb-2 flex items-center gap-2.5 text-[13px] font-semibold text-slate-700">
                任务状态
                <span className="text-[#4252f4]">已完成 8/8</span>
              </div>
              <Progress value={100} className="h-1 bg-indigo-100 [&>div]:bg-[#4d57f5]" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {gallery.map((tone, index) => (
              <ImageCard key={`${tone.sky}-${index}`} tone={tone} index={index + 1} active={index === 0} />
            ))}
          </div>

          <div className="mt-4 flex h-11 items-center justify-between rounded-[10px] border border-emerald-100/80 bg-emerald-50/70 px-4 text-emerald-700">
            <div className="flex items-center gap-2.5 text-[13px] font-semibold">
              <CircleCheck className="size-4" />
              已自动归档到 Eagle
            </div>
            <button className="flex items-center gap-1.5 text-xs font-semibold text-[#4252f4]">
              查看素材
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}

function ImageCard({ tone, index, active }: { tone: LandscapeTone; index: number; active?: boolean }) {
  return (
    <article
      className={cn(
        'overflow-hidden rounded-[10px] border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition',
        active ? 'border-[#4655f4] ring-1 ring-[#4655f4]' : 'border-slate-200/80',
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
      <div className="flex h-9 items-center justify-between px-2.5 text-slate-500">
        <Bookmark className="size-4" />
        <div className="flex items-center gap-3">
          <RefreshCw className="size-3.5" />
          <Separator orientation="vertical" className="h-4 bg-slate-200/70" />
          <MoreHorizontal className="size-4" />
        </div>
      </div>
    </article>
  )
}

function InfoBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold text-slate-700">{title}</h3>
      <dl className="flex flex-col gap-3 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[70px_1fr] gap-3">
            <dt className="text-slate-500">{label}</dt>
            <dd className="min-w-0 leading-5 text-slate-700">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export default App

type LandscapeTone = {
  sky: string
  dusk: string
  ridge: string
  sun: string
}

function Landscape({ tone, compact = false }: { tone: LandscapeTone; compact?: boolean }) {
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
