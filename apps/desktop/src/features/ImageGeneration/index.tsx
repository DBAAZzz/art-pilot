import { IMAGE_GENERATION_EVENT_TYPES } from '@art-pilot/shared'
import type { ImageGenerationEvent, ImageGenerationSize } from '@art-pilot/shared'
import { useEffect, useRef, useState } from 'react'

import { GenerationForm } from './GenerationForm'
import { type AspectRatio, type ImageCount, GenerationOptions } from './GenerationOptions'
import { RecentTaskList } from './RecentTaskList'

export type TaskStatus = 'running' | 'complete' | 'error' | 'cancelled'

export type RecentTaskImage = {
  index: number
  imageUrl: string
  imagePath: string
}

export type RecentTask = {
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
    <>
      <section className="min-h-0 overflow-y-auto rounded-lg bg-background-solid px-4 py-4">
        <div className="flex w-full flex-col items-stretch">
          <header className="mb-5 text-left">
            <h1 className="text-title font-medium text-text-strong">创作你想的一切</h1>
            <p className="mt-2 text-base text-text-muted">描述画面、氛围和关键细节，Art Pilot 会把它整理成生成任务。</p>
          </header>

          <GenerationForm
            isGenerateDisabled={!prompt.trim() || isGenerating}
            prompt={prompt}
            onGenerate={startGeneration}
            onPromptChange={setPrompt}
          />

          <GenerationOptions
            aspectRatio={aspectRatio}
            onAspectRatioChange={setAspectRatio}
            imageCount={imageCount}
            onImageCountChange={setImageCount}
          />

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
      </section>

      <RecentTaskList tasks={recentTasks} />
    </>
  )
}
