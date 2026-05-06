import { IMAGE_GENERATION_EVENT_TYPES, MAX_IMAGE_REFERENCES } from '@art-pilot/shared'
import type { ImageGenerationAspectRatio, ImageGenerationEvent, ImageGenerationSize, ImageHistoryTask, ImageReference } from '@art-pilot/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

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
  aspectRatio: ImageGenerationAspectRatio
  status: TaskStatus
  createdAt: number
  completedAt?: number
  references: ImageReference[]
  images: RecentTaskImage[]
  message?: string
  error?: string
}

const aspectRatioSizeMap: Record<ImageGenerationAspectRatio, ImageGenerationSize> = {
  '1:1': '1024x1024',
  '4:3': '1536x1024',
  '3:2': '1536x1024',
  '16:9': '1536x1024',
  '9:16': '1024x1536',
}

export function ImageGenerationPage() {
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [imageCount, setImageCount] = useState<ImageCount>(1)
  const [activeJobIds, setActiveJobIds] = useState<Set<string>>(() => new Set())
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const [startError, setStartError] = useState<string | null>(null)
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null)
  const [references, setReferences] = useState<ImageReference[]>([])
  const [submitting, setSubmitting] = useState(false)
  const referencesRef = useRef<ImageReference[]>([])
  const pendingHistoryReloadJobIdsRef = useRef(new Set<string>())

  const loadRecentTasks = useCallback(async (mode: 'replace' | 'merge' = 'replace') => {
    try {
      // 最近任务从 SQLite 恢复；后端同时会把历史图片重新注册到自定义协议 registry。
      const tasks = await window.api.listRecentImageTasks()
      const historyTasks = tasks.map(mapHistoryTaskToRecentTask)

      setRecentTasks((currentTasks) =>
        mode === 'merge'
          ? mergeRecentTasks(currentTasks, historyTasks)
          : sortRecentTasks(historyTasks),
      )
      const runningHistoryJobIds = historyTasks.filter((task) => task.status === 'running').map((task) => task.jobId)
      setActiveJobIds((currentJobIds) => {
        if (mode === 'replace') {
          return new Set(runningHistoryJobIds)
        }

        const terminalHistoryJobIds = new Set(historyTasks.filter((task) => task.status !== 'running').map((task) => task.jobId))
        const nextJobIds = new Set([...currentJobIds].filter((jobId) => !terminalHistoryJobIds.has(jobId)))

        for (const jobId of runningHistoryJobIds) {
          nextJobIds.add(jobId)
        }

        return nextJobIds
      })
    } catch (error) {
      console.error('Failed to load recent image tasks:', error)
    }
  }, [])

  const queueHistoryReload = useCallback((jobId: string) => {
    if (pendingHistoryReloadJobIdsRef.current.has(jobId)) {
      return
    }

    pendingHistoryReloadJobIdsRef.current.add(jobId)
    void loadRecentTasks('merge').finally(() => {
      pendingHistoryReloadJobIdsRef.current.delete(jobId)
    })
  }, [loadRecentTasks])

  useEffect(() => {
    const unsubscribe = window.api.onImageGenerationEvent((event) => {
      handleImageGenerationEvent(event)
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    void loadRecentTasks('replace')
  }, [loadRecentTasks])

  useEffect(() => {
    referencesRef.current = references
  }, [references])

  async function startGeneration() {
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt || submitting) {
      return
    }

    setSubmitting(true)
    setStartError(null)

    try {
      await window.api.startImageGeneration({
        prompt: trimmedPrompt,
        count: imageCount,
        aspectRatio,
        size: aspectRatioSizeMap[aspectRatio],
        references,
      })

      setPrompt('')
      referencesRef.current = []
      setReferences([])
      setReferenceNotice(null)
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error))
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelGeneration(jobId: string) {
    await window.api.cancelImageGeneration(jobId)
  }

  async function selectReferences() {
    setReferenceNotice(null)
    setStartError(null)

    try {
      const selectedReferences = await window.api.selectImageReferences()

      if (selectedReferences.length === 0) {
        return
      }

      addReferences(selectedReferences)
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error))
    }
  }

  async function pasteReferences() {
    setReferenceNotice(null)
    setStartError(null)

    try {
      const pastedReferences = await window.api.pasteImageReferencesFromClipboard()

      if (pastedReferences.length === 0) {
        return false
      }

      addReferences(pastedReferences)
      return true
    } catch (error) {
      setStartError(error instanceof Error ? error.message : String(error))
      return true
    }
  }

  function removeReference(referenceId: string) {
    setReferenceNotice(null)
    const nextReferences = referencesRef.current.filter((reference) => reference.id !== referenceId)
    referencesRef.current = nextReferences
    setReferences(nextReferences)
  }

  function addReferences(nextReferences: ImageReference[]) {
    const currentReferences = referencesRef.current
    const mergedReferences = mergeReferences(currentReferences, nextReferences)
    const currentPaths = new Set(currentReferences.map((reference) => reference.path))
    const newReferencePaths = new Set(
      nextReferences
        .map((reference) => reference.path)
        .filter((referencePath) => !currentPaths.has(referencePath)),
    )

    if (currentReferences.length + newReferencePaths.size > MAX_IMAGE_REFERENCES) {
      setReferenceNotice(`参考图最多保留 ${MAX_IMAGE_REFERENCES} 张，已自动忽略超出的图片。`)
    }

    referencesRef.current = mergedReferences
    setReferences(mergedReferences)
  }

  function handleImageGenerationEvent(event: ImageGenerationEvent) {
    if (event.type === IMAGE_GENERATION_EVENT_TYPES.started) {
      setActiveJobIds((jobIds) => new Set(jobIds).add(event.jobId))
      setRecentTasks((tasks) => {
        if (tasks.some((task) => task.jobId === event.jobId)) {
          return sortRecentTasks(tasks)
        }

        return sortRecentTasks([
          {
            jobId: event.jobId,
            prompt: event.prompt,
            count: event.count,
            aspectRatio: event.aspectRatio ?? getAspectRatioFromSize(event.size),
            status: 'running',
            createdAt: event.createdAt,
            references: event.references ?? [],
            images: [],
          },
          ...tasks,
        ])
      })
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.imageFound) {
      setRecentTasks((tasks) =>
        updateTaskOrCreatePlaceholder(tasks, event.jobId, (task) => {
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
      queueHistoryReload(event.jobId)
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.codexThreadStarted) {
      setRecentTasks((tasks) =>
        updateTaskOrCreatePlaceholder(tasks, event.jobId, (task) => ({
          ...task,
          codexThreadId: event.codexThreadId,
        })),
      )
      queueHistoryReload(event.jobId)
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.message) {
      setRecentTasks((tasks) =>
        updateTaskOrCreatePlaceholder(tasks, event.jobId, (task) => ({
          ...task,
          message: event.text,
        })),
      )
      queueHistoryReload(event.jobId)
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.complete) {
      setRecentTasks((tasks) =>
        updateTaskOrCreatePlaceholder(tasks, event.jobId, (task) => ({
          ...task,
          status: 'complete',
          completedAt: Date.now(),
        })),
      )
      setActiveJobIds((jobIds) => deleteJobId(jobIds, event.jobId))
      queueHistoryReload(event.jobId)
      return
    }

    if (event.type === IMAGE_GENERATION_EVENT_TYPES.error) {
      setRecentTasks((tasks) =>
        updateTaskOrCreatePlaceholder(tasks, event.jobId, (task) => ({
          ...task,
          status: event.reason === 'cancelled' ? 'cancelled' : 'error',
          error: event.error,
        })),
      )
      setActiveJobIds((jobIds) => deleteJobId(jobIds, event.jobId))
      queueHistoryReload(event.jobId)
    }
  }

  return (
    <>
      <section className="min-h-0 overflow-y-auto rounded-lg bg-background-solid px-4 py-4">
        <div className="flex w-full flex-col items-stretch">
          <header className="mb-5 text-left">
            <h1 className="text-xl font-semibold text-text-strong">该做些什么</h1>
            <p className="mt-2 text-base text-text-muted">描述画面、氛围和关键细节，Art Pilot 会把它整理成生成任务。</p>
          </header>

          <div className="relative pb-12">
            <div className="relative z-10">
              <GenerationForm
                isGenerateDisabled={!prompt.trim() || submitting}
                prompt={prompt}
                references={references}
                onGenerate={startGeneration}
                onPromptChange={setPrompt}
                onRemoveReference={removeReference}
                onAddReferences={addReferences}
                onPasteReferences={pasteReferences}
                onSelectReferences={selectReferences}
              />
            </div>

            <div className="absolute inset-x-0 bottom-0 flex h-16 items-end rounded-b-xl bg-background-subtle px-2 pb-2 pt-3">
              <GenerationOptions
                aspectRatio={aspectRatio}
                imageCount={imageCount}
                onAspectRatioChange={setAspectRatio}
                onImageCountChange={setImageCount}
              />
            </div>
          </div>

          {activeJobIds.size > 0 ? <p className="mt-3 text-base text-text-muted">正在运行 {activeJobIds.size} 个任务</p> : null}
          {referenceNotice ? <p className="mt-3 text-base text-text-muted">{referenceNotice}</p> : null}
          {startError ? <p className="mt-3 text-base text-text-muted">{startError}</p> : null}
        </div>
      </section>

      <RecentTaskList tasks={recentTasks} onCancelTask={cancelGeneration} />
    </>
  )
}

function mapHistoryTaskToRecentTask(task: ImageHistoryTask): RecentTask {
  // 历史记录使用 shared 类型，页面内部继续复用现有 RecentTask 卡片结构。
  return {
    jobId: task.jobId,
    codexThreadId: task.codexThreadId,
    prompt: task.prompt,
    count: task.count,
    aspectRatio: getAspectRatioFromHistoryTask(task),
    status: task.status,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    references: task.references,
    images: task.images.map((image) => ({
      index: image.index,
      imageUrl: image.imageUrl,
      imagePath: image.imagePath,
    })),
    error: task.error,
  }
}

function createPlaceholderTask(jobId: string): RecentTask {
  console.warn('Received image generation event for unknown task:', jobId)

  return {
    jobId,
    prompt: '生成任务',
    count: 0,
    aspectRatio: '1:1',
    status: 'running',
    createdAt: Date.now(),
    references: [],
    images: [],
  }
}

function updateTaskOrCreatePlaceholder(
  tasks: RecentTask[],
  jobId: string,
  updateTask: (task: RecentTask) => RecentTask,
) {
  const currentTasks = tasks.some((task) => task.jobId === jobId)
    ? tasks
    : [createPlaceholderTask(jobId), ...tasks]

  return sortRecentTasks(currentTasks.map((task) => (task.jobId === jobId ? updateTask(task) : task)))
}

function mergeRecentTasks(currentTasks: RecentTask[], historyTasks: RecentTask[]) {
  const mergedTasksById = new Map(currentTasks.map((task) => [task.jobId, task]))

  for (const historyTask of historyTasks) {
    const currentTask = mergedTasksById.get(historyTask.jobId)

    if (!currentTask) {
      mergedTasksById.set(historyTask.jobId, historyTask)
      continue
    }

    mergedTasksById.set(historyTask.jobId, {
      ...currentTask,
      ...historyTask,
      images: mergeRecentTaskImages(currentTask.images, historyTask.images),
      message: historyTask.status === 'running' ? currentTask.message : undefined,
      error: historyTask.error ?? currentTask.error,
    })
  }

  return sortRecentTasks([...mergedTasksById.values()])
}

function mergeRecentTaskImages(currentImages: RecentTaskImage[], historyImages: RecentTaskImage[]) {
  const imagesByIndex = new Map(currentImages.map((image) => [image.index, image]))

  for (const image of historyImages) {
    imagesByIndex.set(image.index, image)
  }

  return [...imagesByIndex.values()].sort((left, right) => left.index - right.index)
}

function mergeReferences(existingReferences: ImageReference[], incomingReferences: ImageReference[]) {
  const existingPaths = new Set(existingReferences.map((reference) => reference.path))
  const newReferences = incomingReferences.filter((reference) => {
    if (existingPaths.has(reference.path)) {
      return false
    }

    existingPaths.add(reference.path)
    return true
  })

  return [...existingReferences, ...newReferences].slice(0, MAX_IMAGE_REFERENCES)
}

function sortRecentTasks(tasks: RecentTask[]) {
  return [...tasks].sort((left, right) => right.createdAt - left.createdAt)
}

function deleteJobId(jobIds: Set<string>, jobId: string) {
  const nextJobIds = new Set(jobIds)
  nextJobIds.delete(jobId)
  return nextJobIds
}

function getAspectRatioFromHistoryTask(task: ImageHistoryTask): ImageGenerationAspectRatio {
  return isImageGenerationAspectRatio(task.aspectRatio)
    ? task.aspectRatio
    : getAspectRatioFromSize(task.size)
}

function getAspectRatioFromSize(size: ImageHistoryTask['size']): ImageGenerationAspectRatio {
  // v1 数据库只保存实际传给 Codex 的尺寸；恢复 UI 时映射到最接近的比例标签。
  if (size === '1024x1536') {
    return '9:16'
  }

  if (size === '1536x1024') {
    return '3:2'
  }

  return '1:1'
}

function isImageGenerationAspectRatio(value: unknown): value is ImageGenerationAspectRatio {
  return value === '1:1'
    || value === '4:3'
    || value === '3:2'
    || value === '16:9'
    || value === '9:16'
}
