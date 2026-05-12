import { IMAGE_GENERATION_EVENT_TYPES, MAX_IMAGE_REFERENCES } from '@art-pilot/shared'
import type { ImageGenerationAspectRatio, ImageGenerationEvent, ImageGenerationSize, ImageHistoryTask, ImageReference, PromptImageBinding, PromptImageVariable, PromptTemplate } from '@art-pilot/shared'
import { getImageVariableMaxCount } from '@art-pilot/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'

import { GenerationForm } from './GenerationForm'
import { type AspectRatio, type ImageCount, GenerationOptions } from './GenerationOptions'
import { PromptTemplateVariablePanel, buildPromptVariableValues, createPromptImageInputValue, mapPromptImagesToReferences } from './PromptTemplateVariablePanel'
import type { PromptImageInputValue } from './PromptTemplateVariablePanel'
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
const RECENT_TASKS_WIDTH_STORAGE_KEY = 'art-pilot:image-generation-recent-tasks-width'
const DEFAULT_RECENT_TASKS_WIDTH = 360
const MIN_RECENT_TASKS_WIDTH = 280
const MAX_RECENT_TASKS_WIDTH = 360
const PANEL_RESIZER_WIDTH = 8

export function ImageGenerationPage() {
  const location = useLocation()
  const panelContainerRef = useRef<HTMLDivElement | null>(null)
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [imageCount, setImageCount] = useState<ImageCount>(1)
  const [recentTasksWidth, setRecentTasksWidth] = useState(() => readStoredRecentTasksWidth())
  const [activeJobIds, setActiveJobIds] = useState<Set<string>>(() => new Set())
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const startState = useLoadingState()
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null)
  const [references, setReferences] = useState<ImageReference[]>([])
  const referencesRef = useRef<ImageReference[]>([])

  // Template runtime state
  const [template, setTemplate] = useState<PromptTemplate | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)
  const [textValues, setTextValues] = useState<Record<string, string>>({})
  const [imageValues, setImageValues] = useState<Record<string, PromptImageInputValue[]>>({})
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false)
  const pendingHistoryReloadJobIdsRef = useRef(new Set<string>())
  const handlePanelResizeDrag = useCallback((event: PointerEvent, resizeState: { startX: number, startWidth: number }) => {
    setRecentTasksWidth(clampRecentTasksWidth(resizeState.startWidth - (event.clientX - resizeState.startX), panelContainerRef.current))
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
    window.localStorage.setItem(RECENT_TASKS_WIDTH_STORAGE_KEY, String(recentTasksWidth))
  }, [recentTasksWidth])

  useEffect(() => {
    const container = panelContainerRef.current

    if (!container) {
      return
    }

    const resizeObserver = new ResizeObserver(() => {
      setRecentTasksWidth((currentWidth) => clampRecentTasksWidth(currentWidth, container))
    })

    resizeObserver.observe(container)
    setRecentTasksWidth((currentWidth) => clampRecentTasksWidth(currentWidth, container))

    return () => resizeObserver.disconnect()
  }, [])

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
        templateId?: string
        prompt?: string
        references?: ImageReference[]
      }
    } | null

    if (!state?.assetReuse && !state?.promptTemplateUse) {
      return
    }

    if (state.promptTemplateUse) {
      if (state.promptTemplateUse.templateId) {
        void loadTemplate(state.promptTemplateUse.templateId)
      } else if (state.promptTemplateUse.prompt) {
        setPrompt(state.promptTemplateUse.prompt)

        if (state.promptTemplateUse.references?.length) {
          addReferences(state.promptTemplateUse.references)
        }
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
      if (template) {
        const values = buildPromptVariableValues(template.variables, textValues, imageValues)
        const resolved = await window.api.resolvePromptTemplate({
          templateId: template.id,
          values,
        })
        const imageRefs = mapPromptImagesToReferences(resolved.imageInputs, imageValues)
        const allReferences = [...imageRefs, ...references].slice(0, MAX_IMAGE_REFERENCES)
        const imageBindings = buildImageBindings(template, imageValues, imageRefs)

        await window.api.startImageGeneration({
          prompt: resolved.prompt,
          count: imageCount,
          aspectRatio,
          size: aspectRatioSizeMap[aspectRatio],
          references: allReferences,
          promptTemplateUse: {
            templateId: template.id,
            templateTitle: template.title,
            values,
            imageBindings,
          },
        })
      } else {
        await window.api.startImageGeneration({
          prompt: trimmedPrompt,
          count: imageCount,
          aspectRatio,
          size: aspectRatioSizeMap[aspectRatio],
          references,
        })
      }

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

  async function loadTemplate(templateId: string) {
    setTemplateLoading(true)
    setTemplateError(null)

    try {
      const loaded = await window.api.getPromptTemplateById(templateId)

      if (!loaded) {
        setTemplateError('模板不存在或已被删除，请返回提示词管理页重新选择。')
        return
      }

      setTemplate(loaded)
      setTextValues(Object.fromEntries(
        loaded.variables
          .filter((v) => v.type === 'text')
          .map((v) => [v.key, v.type === 'text' ? (v.defaultValue ?? '') : '']),
      ))
      setImageValues({})
      setPrompt(loaded.content)
    } catch (error) {
      setTemplateError(getErrorMessage(error))
    } finally {
      setTemplateLoading(false)
    }
  }

  function exitTemplate() {
    if (hasTemplateVariablesFilled(template, textValues, imageValues)) {
      setExitConfirmOpen(true)
      return
    }

    clearTemplateState()
  }

  function handleConfirmExit() {
    clearTemplateState()
    setExitConfirmOpen(false)
  }

  function clearTemplateState() {
    setTemplate(null)
    setTextValues({})
    setImageValues({})
    setTemplateError(null)
    setPrompt('')
  }

  function handleTemplateTextChange(key: string, value: string) {
    setTextValues((current) => ({ ...current, [key]: value }))
  }

  async function handleTemplateImageSelect(variable: PromptImageVariable, files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    const maxCount = getImageVariableMaxCount(variable)
    const nextImages = (await Promise.all(
      [...files].slice(0, maxCount).map(createPromptImageInputValue),
    )).filter((img): img is PromptImageInputValue => Boolean(img))

    setImageValues((current) => ({
      ...current,
      [variable.key]: nextImages,
    }))
  }

  function handleTemplateImageRemove(variableKey: string, imageId: string) {
    setImageValues((current) => ({
      ...current,
      [variableKey]: (current[variableKey] ?? []).filter((img) => img.id !== imageId),
    }))
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
        startWidth: recentTasksWidth,
      },
    })
  }

  function resetFormPanelWidth() {
    setRecentTasksWidth(clampRecentTasksWidth(DEFAULT_RECENT_TASKS_WIDTH, panelContainerRef.current))
  }

  function handlePanelResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setRecentTasksWidth((currentWidth) => clampRecentTasksWidth(currentWidth + 8, panelContainerRef.current))
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setRecentTasksWidth((currentWidth) => clampRecentTasksWidth(currentWidth - 8, panelContainerRef.current))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setRecentTasksWidth(clampRecentTasksWidth(MAX_RECENT_TASKS_WIDTH, panelContainerRef.current))
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setRecentTasksWidth(clampRecentTasksWidth(MIN_RECENT_TASKS_WIDTH, panelContainerRef.current))
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
          completedAt: Date.now(),
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
      className="col-span-2 grid min-h-0 min-w-0 overflow-hidden"
      style={{ gridTemplateColumns: `minmax(0, 1fr) ${PANEL_RESIZER_WIDTH}px ${recentTasksWidth}px` }}
    >
      <section className="min-h-0 min-w-0 overflow-y-auto rounded-lg bg-background-solid px-6 pb-4 pt-10">
        <div className="mx-auto flex w-full max-w-[760px] flex-col items-stretch">
          <header className="mb-5 text-left">
            <h1 className="text-xl font-semibold text-text-strong">该做些什么</h1>
            <p className="mt-2 text-base text-text-muted">描述画面、氛围和关键细节，Art Pilot 会把它整理成生成任务。</p>
          </header>

          {template ? (
            <div className="mb-4">
              <PromptTemplateVariablePanel
                imageValues={imageValues}
                template={template}
                textValues={textValues}
                onExit={exitTemplate}
                onImageRemove={handleTemplateImageRemove}
                onImageSelect={handleTemplateImageSelect}
                onTextChange={handleTemplateTextChange}
              />
            </div>
          ) : null}

          {templateLoading ? (
            <div className="mb-4 rounded-lg bg-background-subtle p-3 text-base text-text-muted">加载模板中...</div>
          ) : null}

          {templateError ? (
            <div className="mb-4 rounded-lg bg-background-subtle p-3 text-base text-text-error">{templateError}</div>
          ) : null}

          <div className="relative pb-12">
            <div className="relative z-10">
              <GenerationForm
                isGenerateDisabled={!prompt.trim() || startState.loading}
                isReadOnly={!!template}
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
        aria-label="调整最近任务宽度"
        aria-orientation="vertical"
        aria-valuemax={MAX_RECENT_TASKS_WIDTH}
        aria-valuemin={MIN_RECENT_TASKS_WIDTH}
        aria-valuenow={recentTasksWidth}
        className="group flex cursor-col-resize items-stretch justify-start bg-fill-hover"
        role="separator"
        tabIndex={0}
        title="拖动调整最近任务宽度，双击恢复默认"
        onDoubleClick={resetFormPanelWidth}
        onKeyDown={handlePanelResizeKeyDown}
        onPointerDown={startPanelResize}
      >
        <span className="block w-px rounded-full bg-border transition-colors group-hover:bg-border-hover group-focus-visible:bg-border-hover" />
      </div>

      <RecentTaskList tasks={recentTasks} onCancelTask={cancelGeneration} />

      {exitConfirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6 py-6">
          <div className="w-full max-w-md rounded-lg border border-border bg-background-solid p-6 shadow-xl">
            <h2 className="text-base font-semibold text-text-strong">退出模板模式</h2>
            <p className="mt-2 text-base text-text-muted">
              当前已填写的变量数据将会丢失，确定要退出吗？
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg px-3 text-base font-semibold text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
                type="button"
                onClick={() => setExitConfirmOpen(false)}
              >
                取消
              </button>
              <button
                className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg bg-text-strong px-3 text-base font-semibold text-background-solid transition-colors hover:bg-text-muted"
                type="button"
                onClick={handleConfirmExit}
              >
                确定退出
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function readStoredRecentTasksWidth() {
  const storedValue = window.localStorage.getItem(RECENT_TASKS_WIDTH_STORAGE_KEY)
  const parsedValue = storedValue ? Number(storedValue) : DEFAULT_RECENT_TASKS_WIDTH

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_RECENT_TASKS_WIDTH
  }

  return clampRecentTasksWidth(parsedValue)
}

function clampRecentTasksWidth(width: number, container: HTMLElement | null = null) {
  const containerMaxWidth = container
    ? container.clientWidth - PANEL_RESIZER_WIDTH
    : MAX_RECENT_TASKS_WIDTH
  const maxWidth = Math.max(MIN_RECENT_TASKS_WIDTH, Math.min(MAX_RECENT_TASKS_WIDTH, containerMaxWidth))

  return Math.min(maxWidth, Math.max(MIN_RECENT_TASKS_WIDTH, Math.round(width)))
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

function hasTemplateVariablesFilled(
  template: PromptTemplate | null,
  textValues: Record<string, string>,
  imageValues: Record<string, PromptImageInputValue[]>,
): boolean {
  if (!template) {
    return false
  }

  for (const variable of template.variables) {
    if (variable.type === 'text') {
      const value = textValues[variable.key]?.trim()

      if (value && value !== (variable.defaultValue?.trim() ?? '')) {
        return true
      }
    } else {
      const images = imageValues[variable.key]

      if (images && images.length > 0) {
        return true
      }
    }
  }

  return false
}

function buildImageBindings(
  template: PromptTemplate,
  imageValues: Record<string, PromptImageInputValue[]>,
  imageRefs: ImageReference[],
): PromptImageBinding[] {
  const bindings: PromptImageBinding[] = []
  let currentIndex = 1

  for (const variable of template.variables) {
    if (variable.type !== 'image') {
      continue
    }

    const images = imageValues[variable.key] ?? []

    if (images.length === 0) {
      continue
    }

    const imageIds = images.map((img) => img.id)
    const refIds = imageRefs
      .filter((ref) => imageIds.includes(ref.id))
      .map((ref) => ref.id)

    if (refIds.length !== imageIds.length) {
      console.warn(
        'buildImageBindings: some variable images were not found in references',
        { variableKey: variable.key, expected: imageIds.length, found: refIds.length },
      )
    }

    if (refIds.length > 0) {
      bindings.push({
        variableKey: variable.key,
        variableLabel: variable.label,
        role: variable.role,
        imageReferenceIds: refIds,
        startIndex: currentIndex,
        count: refIds.length,
      })
      currentIndex += refIds.length
    }
  }

  return bindings
}
