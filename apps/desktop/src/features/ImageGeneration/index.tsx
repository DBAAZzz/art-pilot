import { IMAGE_GENERATION_EVENT_TYPES } from '@art-pilot/shared'
import type { ImageGenerationEvent, ImageGenerationSize } from '@art-pilot/shared'
import { Clock3, ImagePlus, Loader2, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const aspectRatioOptions = ['1:1', '4:3', '3:2', '16:9', '9:16'] as const
const imageCountOptions = [1, 2, 4] as const

type AspectRatio = (typeof aspectRatioOptions)[number]
type ImageCount = (typeof imageCountOptions)[number]
type TaskStatus = 'running' | 'complete' | 'error' | 'cancelled'

type RecentTaskImage = {
  index: number
  imageUrl: string
  imagePath: string
}

type RecentTask = {
  jobId: string
  codexThreadId?: string
  prompt: string
  count: number
  aspectRatio: AspectRatio
  status: TaskStatus
  createdAt: number
  images: RecentTaskImage[]
  message?: string
  error?: string
}

const aspectRatioSizeMap: Record<AspectRatio, ImageGenerationSize> = {
  '1:1': '1024x1024',
  '4:3': '1536x1024',
  '3:2': '1536x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
}

export function ImageGenerationPage() {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [imageCount, setImageCount] = useState<ImageCount>(2)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const [startError, setStartError] = useState<string | null>(null)
  const latestRequestRef = useRef<Omit<RecentTask, 'jobId' | 'status' | 'images' | 'createdAt'> | null>(null)

  const promptLengthText = useMemo(() => `${prompt.trim().length}/2000`, [prompt])
  const isGenerating = activeJobId !== null

  useEffect(() => {
    const unsubscribe = window.api.onImageGenerationEvent((event) => {
      handleImageGenerationEvent(event)
    })

    return unsubscribe
  }, [])

  async function startGeneration() {
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt || isGenerating) {
      return
    }

    setStartError(null)
    latestRequestRef.current = {
      prompt: trimmedPrompt,
      count: imageCount,
      aspectRatio,
    }

    try {
      const { jobId } = await window.api.startImageGeneration({
        prompt: trimmedPrompt,
        count: imageCount,
        size: aspectRatioSizeMap[aspectRatio],
        references: [],
      })

      setActiveJobId(jobId)
      setPrompt('')
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error))
      latestRequestRef.current = null
    }
  }

  async function cancelGeneration() {
    if (!activeJobId) {
      return
    }

    await window.api.cancelImageGeneration(activeJobId)
  }

  function handleImageGenerationEvent(event: ImageGenerationEvent) {
    if (event.type === IMAGE_GENERATION_EVENT_TYPES.started) {
      setActiveJobId(event.jobId)
      setRecentTasks((tasks) => {
        if (tasks.some((task) => task.jobId === event.jobId)) {
          return tasks
        }

        const requestSnapshot = latestRequestRef.current

        return [
          {
            jobId: event.jobId,
            prompt: requestSnapshot?.prompt ?? '生成任务',
            count: event.count,
            aspectRatio: requestSnapshot?.aspectRatio ?? '1:1',
            status: 'running',
            createdAt: Date.now(),
            images: [],
          },
          ...tasks,
        ]
      })
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.imageFound) {
      setRecentTasks((tasks) =>
        tasks.map((task) => {
          if (task.jobId !== event.jobId) {
            return task
          }

          const images = task.images.some((image) => image.index === event.index)
            ? task.images
            : [
                ...task.images,
                {
                  index: event.index,
                  imageUrl: event.imageUrl,
                  imagePath: event.imagePath,
                },
              ].sort((left, right) => left.index - right.index)

          return {
            ...task,
            images,
          }
        }),
      )
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.codexThreadStarted) {
      setRecentTasks((tasks) =>
        tasks.map((task) =>
          task.jobId === event.jobId
            ? {
                ...task,
                codexThreadId: event.codexThreadId,
              }
            : task,
        ),
      )
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.message) {
      setRecentTasks((tasks) =>
        tasks.map((task) =>
          task.jobId === event.jobId
            ? {
                ...task,
                message: event.text,
              }
            : task,
        ),
      )
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.complete) {
      setRecentTasks((tasks) =>
        tasks.map((task) =>
          task.jobId === event.jobId
            ? {
                ...task,
                status: 'complete',
              }
            : task,
        ),
      )
      setActiveJobId((jobId) => (jobId === event.jobId ? null : jobId))
      latestRequestRef.current = null
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.error) {
      setRecentTasks((tasks) =>
        tasks.map((task) =>
          task.jobId === event.jobId
            ? {
                ...task,
                status: event.reason === 'cancelled' ? 'cancelled' : 'error',
                error: event.error,
              }
            : task,
        ),
      )
      setActiveJobId((jobId) => (jobId === event.jobId ? null : jobId))
      latestRequestRef.current = null
    }
  }

  return (
    <section className="col-span-2 grid min-h-0 grid-cols-[minmax(0,1fr)_260px] gap-4">
      <div className="flex min-h-0 items-center justify-center rounded-lg border border-border bg-background-solid px-10 py-8">
        <div className="flex w-full max-w-[920px] flex-col items-center">
          <header className="mb-8 text-center">
            <h1 className="text-title font-medium text-text-strong">你想创作什么？</h1>
            <p className="mt-2 text-base text-text-muted">描述画面、氛围和关键细节，Art Pilot 会把它整理成生成任务。</p>
          </header>

          <div className="w-full rounded-lg border border-border bg-fill">
            <textarea
              className="min-h-[220px] w-full resize-none rounded-lg bg-transparent px-5 py-4 text-base text-text-strong outline-none placeholder:text-text-muted"
              maxLength={2000}
              placeholder="例如：清晨的湖边山谷，薄雾、柔和光线、远处有雪山，画面安静干净..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />

            <div className="flex items-center justify-between gap-3 border-t border-separator-subtle px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background-solid px-3 text-base text-text-muted transition-colors hover:border-border-hover hover:bg-fill-hover hover:text-text-strong"
                  type="button"
                >
                  <ImagePlus className="size-4" strokeWidth={1.8} />
                  <span>参考图</span>
                </button>
                <div className="flex h-8 items-center gap-2 rounded-lg border border-border bg-background-subtle px-3 text-base text-text-muted">
                  <ImagePlus className="size-4" strokeWidth={1.8} />
                  <span>静态占位</span>
                  <button className="cursor-pointer text-text-muted hover:text-text-strong" type="button" aria-label="移除参考图占位">
                    <X className="size-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              </div>

              <span className="shrink-0 text-base text-text-muted">{promptLengthText}</span>
            </div>
          </div>

          <div className="mt-6 grid w-full grid-cols-[minmax(0,1fr)_220px] gap-6">
            <OptionGroup label="画面比例">
              {aspectRatioOptions.map((option) => (
                <SegmentButton
                  key={option}
                  active={aspectRatio === option}
                  label={option}
                  onClick={() => setAspectRatio(option)}
                />
              ))}
            </OptionGroup>

            <OptionGroup label="生成张数">
              {imageCountOptions.map((option) => (
                <SegmentButton
                  key={option}
                  active={imageCount === option}
                  label={String(option)}
                  onClick={() => setImageCount(option)}
                />
              ))}
            </OptionGroup>
          </div>

          <button
            className="mt-8 flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-text-strong px-5 text-base font-medium text-background-solid transition-colors hover:bg-text-muted disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!prompt.trim() || isGenerating}
            type="button"
            onClick={startGeneration}
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
            ) : (
              <Sparkles className="size-4" strokeWidth={1.8} />
            )}
            <span>{isGenerating ? '生成中' : '生成'}</span>
          </button>
          {isGenerating ? (
            <button
              className="mt-3 cursor-pointer rounded-lg px-3 py-1.5 text-base text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
              type="button"
              onClick={cancelGeneration}
            >
              取消当前任务
            </button>
          ) : null}
          {startError ? <p className="mt-3 text-base text-text-muted">{startError}</p> : null}
        </div>
      </div>

      <aside className="flex min-h-0 flex-col rounded-lg border border-border bg-background-solid p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-medium text-text-strong">最近任务</h2>
          <Clock3 className="size-4 text-text-muted" strokeWidth={1.8} />
        </div>

        {recentTasks.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-background-subtle px-4 text-center">
            <p className="text-base text-text-muted">暂无最近任务</p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {recentTasks.map((task) => (
              <RecentTaskItem key={task.jobId} task={task} />
            ))}
          </div>
        )}
      </aside>
    </section>
  )
}

function RecentTaskItem({ task }: { task: RecentTask }) {
  const coverImage = task.images[0]

  return (
    <article className="rounded-lg border border-border bg-fill p-2">
      <div className="mb-2 aspect-[4/3] overflow-hidden rounded-lg border border-border bg-background-subtle">
        {coverImage ? (
          <img
            alt={task.prompt}
            className="size-full object-cover"
            src={coverImage.imageUrl}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-base text-text-muted">
            {task.status === 'running' ? (
              <Loader2 className="size-5 animate-spin" strokeWidth={1.8} />
            ) : (
              <ImagePlus className="size-5" strokeWidth={1.8} />
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-medium text-text-strong">{getTaskStatusText(task.status)}</span>
          <span className="shrink-0 text-base text-text-muted">
            {task.images.length}/{task.count}
          </span>
        </div>
        <p className="line-clamp-2 text-base text-text-muted">{task.prompt}</p>
        {task.message && task.status === 'running' ? <p className="line-clamp-2 text-base text-text-muted">{task.message}</p> : null}
        <div className="flex items-center justify-between gap-2 text-base text-text-muted">
          <span>{task.aspectRatio}</span>
          <span>{formatTaskTime(task.createdAt)}</span>
        </div>
        {task.error ? <p className="line-clamp-2 text-base text-text-muted">{task.error}</p> : null}
      </div>
    </article>
  )
}

function OptionGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-base font-medium text-text-muted">{label}</div>
      <div className="grid h-9 grid-flow-col auto-cols-fr rounded-lg border border-border bg-background-subtle p-1">
        {children}
      </div>
    </div>
  )
}

function SegmentButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={cn(
        'h-full cursor-pointer rounded-lg px-3 text-base transition-colors',
        active
          ? 'bg-background-solid font-medium text-text-strong'
          : 'text-text-muted hover:bg-fill-hover hover:text-text-strong',
      )}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function getTaskStatusText(status: TaskStatus) {
  if (status === 'running') {
    return '生成中'
  }

  if (status === 'complete') {
    return '已完成'
  }

  if (status === 'cancelled') {
    return '已取消'
  }

  return '失败'
}

function formatTaskTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
