import { IMAGE_GENERATION_EVENT_TYPES, MAX_IMAGE_REFERENCES } from '@art-pilot/shared'
import type { ImageGenerationAspectRatio, ImageGenerationEvent, ImageGenerationSize, ImageHistoryTask, ImageReference } from '@art-pilot/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { GenerationForm } from './GenerationForm'
import { type AspectRatio, type ImageCount, GenerationOptions } from './GenerationOptions'
import { RecentTaskList } from './RecentTaskList'
import { getErrorMessage, useLoadingState } from '@/hooks/useLoadingState'
import { usePointerDrag } from '@/hooks/usePointerDrag'

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
const FORM_PANEL_WIDTH_STORAGE_KEY = 'art-pilot:image-generation-form-panel-width'
const DEFAULT_FORM_PANEL_WIDTH = 360
const MIN_FORM_PANEL_WIDTH = 300
const MAX_FORM_PANEL_WIDTH = 520
const MIN_RECENT_TASKS_WIDTH = 360
const PANEL_RESIZER_WIDTH = 12

export function ImageGenerationPage() {
  const location = useLocation()
  const panelContainerRef = useRef<HTMLDivElement | null>(null)
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [imageCount, setImageCount] = useState<ImageCount>(1)
  const [formPanelWidth, setFormPanelWidth] = useState(() => readStoredFormPanelWidth())
  const [activeJobIds, setActiveJobIds] = useState<Set<string>>(() => new Set())
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const startState = useLoadingState()
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null)
  const [references, setReferences] = useState<ImageReference[]>([])
  const referencesRef = useRef<ImageReference[]>([])
  const pendingHistoryReloadJobIdsRef = useRef(new Set<string>())
  const handlePanelResizeDrag = useCallback((event: PointerEvent, resizeState: { startX: number, startWidth: number }) => {
    setFormPanelWidth(clampFormPanelWidth(resizeState.startWidth + event.clientX - resizeState.startX, panelContainerRef.current))
  }, [])
  const panelResizeDrag = usePointerDrag({
    cursor: 'col-resize',
    onDrag: handlePanelResizeDrag,
    userSelect: 'none',
  })

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
    window.localStorage.setItem(FORM_PANEL_WIDTH_STORAGE_KEY, String(formPanelWidth))
  }, [formPanelWidth])

  useEffect(() => {
    void loadRecentTasks('replace')
  }, [loadRecentTasks])

  useEffect(() => {
    referencesRef.current = references
  }, [references])

  useEffect(() => {
    const state = location.state as {
      assetReuse?: {
        prompt?: string
        reference?: ImageReference
      }
      promptTemplateUse?: {
        prompt: string
        references?: ImageReference[]
      }
    } | null

    if (!state?.assetReuse && !state?.promptTemplateUse) {
      return
    }

    if (state.promptTemplateUse) {
      setPrompt(state.promptTemplateUse.prompt)

      if (state.promptTemplateUse.references?.length) {
        addReferences(state.promptTemplateUse.references)
      }
    }

    if (state.assetReuse?.prompt) {
      setPrompt(state.assetReuse.prompt)
    }

    if (state.assetReuse?.reference) {
      addReferences([state.assetReuse.reference])
    }
  }, [location.state])

  async function startGeneration() {
    const trimmedPrompt = prompt.trim()

    if (!trimmedPrompt || startState.loading) {
      return
    }

    startState.startLoading()

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
      startState.failLoading(error)
      return
    } finally {
      startState.stopLoading()
    }
  }

  async function cancelGeneration(jobId: string) {
    await window.api.cancelImageGeneration(jobId)
  }

  async function selectReferences() {
    setReferenceNotice(null)
    startState.setError(null)

    try {
      const selectedReferences = await window.api.selectImageReferences()

      if (selectedReferences.length === 0) {
        return
      }

      addReferences(selectedReferences)
    } catch (error) {
      startState.setError(getErrorMessage(error))
    }
  }

  async function pasteReferences() {
    setReferenceNotice(null)
    startState.setError(null)

    try {
      const pastedReferences = await window.api.pasteImageReferencesFromClipboard()

      if (pastedReferences.length === 0) {
        return false
      }

      addReferences(pastedReferences)
      return true
    } catch (error) {
      startState.setError(getErrorMessage(error))
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

  function startPanelResize(event: React.PointerEvent<HTMLDivElement>) {
    panelResizeDrag.startDrag({
      event,
      state: {
        startX: event.clientX,
        startWidth: formPanelWidth,
      },
    })
  }

  function resetFormPanelWidth() {
    setFormPanelWidth(clampFormPanelWidth(DEFAULT_FORM_PANEL_WIDTH, panelContainerRef.current))
  }

  function handlePanelResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setFormPanelWidth((currentWidth) => clampFormPanelWidth(currentWidth - 8, panelContainerRef.current))
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setFormPanelWidth((currentWidth) => clampFormPanelWidth(currentWidth + 8, panelContainerRef.current))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setFormPanelWidth(MIN_FORM_PANEL_WIDTH)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setFormPanelWidth(clampFormPanelWidth(MAX_FORM_PANEL_WIDTH, panelContainerRef.current))
    }
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
    <div
      ref={panelContainerRef}
      className="col-span-2 grid min-h-0"
      style={{ gridTemplateColumns: `${formPanelWidth}px ${PANEL_RESIZER_WIDTH}px minmax(0, 1fr)` }}
    >
      <section className="min-h-0 overflow-y-auto rounded-lg bg-background-solid px-4 py-4">
        <div className="flex w-full flex-col items-stretch">
          <header className="mb-5 text-left">
            <h1 className="text-xl font-semibold text-text-strong">该做些什么</h1>
            <p className="mt-2 text-base text-text-muted">描述画面、氛围和关键细节，Art Pilot 会把它整理成生成任务。</p>
          </header>

          <div className="relative pb-12">
            <div className="relative z-10">
              <GenerationForm
                isGenerateDisabled={!prompt.trim() || startState.loading}
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
          {startState.error ? <p className="mt-3 text-base text-text-muted">{startState.error}</p> : null}
        </div>
      </section>

      <div
        aria-label="调整创作面板宽度"
        aria-orientation="vertical"
        aria-valuemax={MAX_FORM_PANEL_WIDTH}
        aria-valuemin={MIN_FORM_PANEL_WIDTH}
        aria-valuenow={formPanelWidth}
        className="group flex cursor-col-resize items-stretch justify-center px-[5px]"
        role="separator"
        tabIndex={0}
        title="拖动调整宽度，双击恢复默认"
        onDoubleClick={resetFormPanelWidth}
        onKeyDown={handlePanelResizeKeyDown}
        onPointerDown={startPanelResize}
      >
        <span className="my-2 block w-px rounded-full bg-border transition-colors group-hover:bg-border-hover group-focus-visible:bg-border-hover" />
      </div>

      <RecentTaskList tasks={recentTasks} onCancelTask={cancelGeneration} />
    </div>
  )
}

function readStoredFormPanelWidth() {
  const storedValue = window.localStorage.getItem(FORM_PANEL_WIDTH_STORAGE_KEY)
  const parsedValue = storedValue ? Number(storedValue) : DEFAULT_FORM_PANEL_WIDTH

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_FORM_PANEL_WIDTH
  }

  return clampFormPanelWidth(parsedValue)
}

function clampFormPanelWidth(width: number, container: HTMLElement | null = null) {
  const containerMaxWidth = container
    ? container.clientWidth - MIN_RECENT_TASKS_WIDTH - PANEL_RESIZER_WIDTH
    : MAX_FORM_PANEL_WIDTH
  const maxWidth = Math.max(MIN_FORM_PANEL_WIDTH, Math.min(MAX_FORM_PANEL_WIDTH, containerMaxWidth))

  return Math.min(maxWidth, Math.max(MIN_FORM_PANEL_WIDTH, Math.round(width)))
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
