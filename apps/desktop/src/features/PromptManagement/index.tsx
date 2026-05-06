import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileText,
  ImageOff,
  Images,
  LayoutGrid,
  List,
  MessageSquareText,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { PromptImportDraft, PromptRecord, SavePromptRequest } from '@art-pilot/shared'

import { Button } from '@/components/Button'
import { ImagePreviewOverlay } from '@/components/ImagePreviewOverlay'
import { Input } from '@/components/Input'
import { useImagePreview } from '@/hooks/useImagePreview'
import { cn } from '@/lib/utils'

type PromptViewMode = 'list' | 'gallery'

type GalleryFilters = {
  category: string | null
  sourceSite: PromptRecord['sourceSite'] | 'all'
  language: string | 'all'
  imageState: 'all' | 'withImage'
}

type PromptPreviewListItem = {
  imageUrl: string
  index: number
  promptId: string
  promptTitle: string
}

const defaultGalleryFilters: GalleryFilters = {
  category: null,
  sourceSite: 'all',
  language: 'all',
  imageState: 'all',
}

export function PromptManagementPage() {
  const [prompts, setPrompts] = useState<PromptRecord[]>([])
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<PromptViewMode>('list')
  const [galleryFilters, setGalleryFilters] = useState<GalleryFilters>(defaultGalleryFilters)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreatePromptOpen, setIsCreatePromptOpen] = useState(false)
  const [creatingPrompt, setCreatingPrompt] = useState(false)

  const filteredPrompts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return prompts.filter((prompt) => {
      const searchableText = [
        prompt.title,
        prompt.description,
        prompt.content,
        prompt.sourceAuthor,
        prompt.sourceSite,
        prompt.originalLanguage,
        ...prompt.categories,
      ].filter(Boolean).join(' ').toLowerCase()

      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery)
      const matchesCategory = !galleryFilters.category || prompt.categories.includes(galleryFilters.category)
      const matchesSource = galleryFilters.sourceSite === 'all' || prompt.sourceSite === galleryFilters.sourceSite
      const matchesLanguage = galleryFilters.language === 'all' || prompt.originalLanguage === galleryFilters.language
      const matchesImageState = galleryFilters.imageState === 'all' || prompt.previewImages.length > 0

      return matchesQuery && matchesCategory && matchesSource && matchesLanguage && matchesImageState
    })
  }, [galleryFilters, prompts, query])

  const selectedPrompt = useMemo(() => {
    return filteredPrompts.find((prompt) => prompt.id === selectedPromptId) ?? filteredPrompts[0] ?? null
  }, [filteredPrompts, selectedPromptId])

  const selectedPreviewImage = selectedPrompt?.previewImages[selectedImageIndex] ?? selectedPrompt?.previewImages[0]
  const filteredCountLabel = `${filteredPrompts.length} / ${prompts.length} 条`
  const hasActiveGalleryFilters = useMemo(() => {
    return galleryFilters.category !== null
      || galleryFilters.sourceSite !== 'all'
      || galleryFilters.language !== 'all'
      || galleryFilters.imageState !== 'all'
  }, [galleryFilters])
  const filterOptions = useMemo(() => getGalleryFilterOptions(prompts), [prompts])
  const listPreviewImages = useMemo<PromptPreviewListItem[]>(() => {
    return filteredPrompts.flatMap((prompt, promptIndex) => {
      const previewImage = prompt.previewImages[0]

      if (!previewImage) {
        return []
      }

      return [{
        imageUrl: previewImage.url,
        index: promptIndex,
        promptId: prompt.id,
        promptTitle: prompt.title,
      }]
    })
  }, [filteredPrompts])
  const listImagePreview = useImagePreview(listPreviewImages)

  useEffect(() => {
    void loadPrompts()
  }, [])

  useEffect(() => {
    if (!selectedPrompt && filteredPrompts[0]) {
      setSelectedPromptId(filteredPrompts[0].id)
    }
  }, [filteredPrompts, selectedPrompt])

  useEffect(() => {
    setSelectedImageIndex(0)
  }, [selectedPrompt?.id])

  async function loadPrompts() {
    setLoading(true)
    setError(null)

    try {
      const promptRecords = await window.api.listPrompts()
      setPrompts(promptRecords)
      setSelectedPromptId((currentId) => currentId ?? promptRecords[0]?.id ?? null)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }

  async function copyPrompt(prompt: PromptRecord) {
    try {
      await navigator.clipboard.writeText(prompt.content)
      setCopiedPromptId(prompt.id)
      window.setTimeout(() => setCopiedPromptId(null), 1600)
    } catch (copyError) {
      setError(getErrorMessage(copyError))
    }
  }

  async function openOriginalSource(prompt: PromptRecord) {
    if (!prompt.originalSourceUrl) {
      return
    }

    try {
      await window.api.openExternalUrl(prompt.originalSourceUrl)
    } catch (openError) {
      setError(getErrorMessage(openError))
    }
  }

  function showPromptInList(prompt: PromptRecord) {
    setSelectedPromptId(prompt.id)
    setViewMode('list')
  }

  async function createPrompt(request: SavePromptRequest) {
    setCreatingPrompt(true)
    setError(null)

    try {
      const savedPrompt = await window.api.savePrompt(request)
      setPrompts((currentPrompts) => [
        savedPrompt,
        ...currentPrompts.filter((prompt) => prompt.id !== savedPrompt.id),
      ])
      setSelectedPromptId(savedPrompt.id)
      setSelectedImageIndex(0)
      setViewMode('list')
      setIsCreatePromptOpen(false)
    } catch (createError) {
      setError(getErrorMessage(createError))
    } finally {
      setCreatingPrompt(false)
    }
  }

  return (
    <section className="col-span-2 flex min-h-0 flex-col gap-4">
      <PromptPageToolbar
        countLabel={filteredCountLabel}
        hasActiveFilters={hasActiveGalleryFilters}
        query={query}
        viewMode={viewMode}
        onClearFilters={() => setGalleryFilters(defaultGalleryFilters)}
        onCreatePrompt={() => setIsCreatePromptOpen(true)}
        onQueryChange={setQuery}
        onViewModeChange={setViewMode}
      />

      {error ? (
        <div className="rounded-lg border border-border bg-background-solid px-4 py-2 text-base text-text-error">
          {error}
        </div>
      ) : null}

      {viewMode === 'list' ? (
        <PromptListView
          copiedPromptId={copiedPromptId}
          filteredPrompts={filteredPrompts}
          listImagePreview={listImagePreview}
          listPreviewImages={listPreviewImages}
          loading={loading}
          promptsCount={prompts.length}
          selectedPrompt={selectedPrompt}
          selectedImageIndex={selectedImageIndex}
          selectedPreviewImage={selectedPreviewImage}
          onCopy={(prompt) => void copyPrompt(prompt)}
          onCreatePrompt={() => setIsCreatePromptOpen(true)}
          onOpenOriginalSource={() => selectedPrompt ? void openOriginalSource(selectedPrompt) : undefined}
          onSelectImage={setSelectedImageIndex}
          onSelectPrompt={setSelectedPromptId}
        />
      ) : (
        <PromptGalleryView
          copiedPromptId={copiedPromptId}
          filterOptions={filterOptions}
          filters={galleryFilters}
          loading={loading}
          prompts={filteredPrompts}
          promptsCount={prompts.length}
          onCopy={(prompt) => void copyPrompt(prompt)}
          onCreatePrompt={() => setIsCreatePromptOpen(true)}
          onFiltersChange={setGalleryFilters}
          onShowPromptInList={showPromptInList}
        />
      )}

      {isCreatePromptOpen ? (
        <CreatePromptDialog
          saving={creatingPrompt}
          onClose={() => setIsCreatePromptOpen(false)}
          onSave={(request) => void createPrompt(request)}
        />
      ) : null}

      {listImagePreview.isOpen && listImagePreview.previewImage ? (
        <ImagePreviewOverlay
          currentPosition={listImagePreview.currentPosition}
          image={listImagePreview.previewImage}
          imageCount={listImagePreview.imageCount}
          prompt={listImagePreview.previewImage.promptTitle}
          zoom={listImagePreview.zoom}
          onClose={listImagePreview.closePreview}
          onNext={listImagePreview.showNext}
          onPrevious={listImagePreview.showPrevious}
          onResetZoom={listImagePreview.resetZoom}
          onZoomByDelta={listImagePreview.zoomByDelta}
          onZoomIn={listImagePreview.zoomIn}
          onZoomOut={listImagePreview.zoomOut}
        />
      ) : null}
    </section>
  )
}

function PromptPageToolbar({
  countLabel,
  hasActiveFilters,
  query,
  viewMode,
  onClearFilters,
  onCreatePrompt,
  onQueryChange,
  onViewModeChange,
}: {
  countLabel: string
  hasActiveFilters: boolean
  query: string
  viewMode: PromptViewMode
  onClearFilters: () => void
  onCreatePrompt: () => void
  onQueryChange: (query: string) => void
  onViewModeChange: (viewMode: PromptViewMode) => void
}) {
  return (
    <header className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-background-solid px-4 py-3">
      <label className="flex min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-border bg-fill px-3 transition-colors focus-within:border-border-hover">
        <Search className="size-3.5 shrink-0 text-text-muted" strokeWidth={1.8} />
        <Input
          className="h-8 border-0 bg-transparent px-0 focus:border-0"
          placeholder="搜索标题、分类、作者"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>
      <span className="shrink-0 text-base font-medium text-text-muted">{countLabel}</span>
      {hasActiveFilters ? (
        <button
          className="h-8 shrink-0 cursor-pointer rounded-lg px-2.5 text-base font-semibold text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
          type="button"
          onClick={onClearFilters}
        >
          清除筛选
        </button>
      ) : null}
      <Button className="shrink-0 gap-1.5 bg-text-strong text-background-solid hover:bg-text-muted" onClick={onCreatePrompt}>
        <Plus className="size-3.5" strokeWidth={1.8} />
        新建提示词
      </Button>
      <div className="flex shrink-0 rounded-lg bg-fill-hover p-0.5">
        <ViewModeButton
          active={viewMode === 'list'}
          icon={List}
          label="列表"
          onClick={() => onViewModeChange('list')}
        />
        <ViewModeButton
          active={viewMode === 'gallery'}
          icon={LayoutGrid}
          label="画廊"
          onClick={() => onViewModeChange('gallery')}
        />
      </div>
    </header>
  )
}

function ViewModeButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-base font-semibold transition-colors',
        active ? 'bg-background-solid text-text-strong shadow-sm' : 'text-text-muted hover:text-text-strong',
      )}
      type="button"
      onClick={onClick}
    >
      <Icon className="size-3.5" strokeWidth={1.8} />
      {label}
    </button>
  )
}

function PromptListView({
  copiedPromptId,
  filteredPrompts,
  listImagePreview,
  listPreviewImages,
  loading,
  promptsCount,
  selectedPrompt,
  selectedImageIndex,
  selectedPreviewImage,
  onCopy,
  onCreatePrompt,
  onOpenOriginalSource,
  onSelectImage,
  onSelectPrompt,
}: {
  copiedPromptId: string | null
  filteredPrompts: PromptRecord[]
  listImagePreview: ReturnType<typeof useImagePreview<PromptPreviewListItem>>
  listPreviewImages: PromptPreviewListItem[]
  loading: boolean
  promptsCount: number
  selectedPrompt: PromptRecord | null
  selectedImageIndex: number
  selectedPreviewImage?: PromptRecord['previewImages'][number]
  onCopy: (prompt: PromptRecord) => void
  onCreatePrompt: () => void
  onOpenOriginalSource: () => void
  onSelectImage: (index: number) => void
  onSelectPrompt: (promptId: string) => void
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[360px_minmax(0,1fr)] gap-4">
      <aside className="flex min-h-0 flex-col rounded-lg border border-border bg-background-solid">
        <header className="shrink-0 border-b border-border px-4 py-4">
          <div className="flex items-center gap-2 text-base font-semibold text-text-strong">
            <FileText className="size-4 text-text-muted" strokeWidth={1.8} />
            <span>提示词库</span>
          </div>
        </header>

        <div className="art-pilot-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <EmptyState icon={MessageSquareText} title="正在读取提示词" description="稍候片刻" />
          ) : filteredPrompts.length > 0 ? (
            <div className="flex flex-col gap-2">
              {filteredPrompts.map((prompt) => (
                <PromptListItem
                  copied={copiedPromptId === prompt.id}
                  isSelected={prompt.id === selectedPrompt?.id}
                  key={prompt.id}
                  prompt={prompt}
                  previewItem={listPreviewImages.find((image) => image.promptId === prompt.id)}
                  onCopy={() => onCopy(prompt)}
                  onPreviewImage={listImagePreview.openPreview}
                  onSelect={() => onSelectPrompt(prompt.id)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              action={promptsCount > 0 ? undefined : {
                label: '新建提示词',
                onClick: onCreatePrompt,
              }}
              icon={MessageSquareText}
              title={promptsCount > 0 ? '没有匹配结果' : '暂无提示词'}
              description={promptsCount > 0 ? '调整关键词或筛选条件试试' : '你可以手动创建常用的提示词，或从外部导入。'}
            />
          )}
        </div>
      </aside>

      <div className="flex min-h-0 flex-col rounded-lg border border-border bg-background-solid">
        {selectedPrompt ? (
          <PromptDetail
            copied={copiedPromptId === selectedPrompt.id}
            prompt={selectedPrompt}
            selectedImageIndex={selectedImageIndex}
            selectedPreviewImage={selectedPreviewImage}
            onCopy={() => onCopy(selectedPrompt)}
            onOpenOriginalSource={onOpenOriginalSource}
            onSelectImage={onSelectImage}
          />
        ) : (
          <EmptyState icon={MessageSquareText} title="选择一个提示词" description="已导入提示词会在这里显示预览图和内容" />
        )}
      </div>
    </div>
  )
}

function PromptDetail({
  copied,
  prompt,
  selectedImageIndex,
  selectedPreviewImage,
  onCopy,
  onOpenOriginalSource,
  onSelectImage,
}: {
  copied: boolean
  prompt: PromptRecord
  selectedImageIndex: number
  selectedPreviewImage?: PromptRecord['previewImages'][number]
  onCopy: () => void
  onOpenOriginalSource: () => void
  onSelectImage: (index: number) => void
}) {
  const detailPreviewImages = useMemo(() => {
    return prompt.previewImages.map((image, index) => ({
      imageUrl: image.url,
      index,
    }))
  }, [prompt.previewImages])
  const detailImagePreview = useImagePreview(detailPreviewImages)

  return (
    <article className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto]">
      <div className="grid min-h-0 grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="min-h-0 border-r border-border bg-background-subtle p-4">
          {selectedPreviewImage ? (
            <button
              aria-label="预览当前提示词图片"
              className="flex h-full min-h-0 w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg bg-fill"
              type="button"
              onClick={() => {
                const previewImage = detailPreviewImages[selectedImageIndex] ?? detailPreviewImages[0]

                if (previewImage) {
                  detailImagePreview.openPreview(previewImage)
                }
              }}
            >
              <img
                alt={selectedPreviewImage.alt ?? prompt.title}
                className="h-full w-full object-contain"
                src={selectedPreviewImage.url}
              />
            </button>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-lg bg-fill text-text-muted">
              <div className="flex flex-col items-center gap-3 text-center">
                <ImageOff className="size-8" strokeWidth={1.8} />
                <span className="text-base">没有预览图</span>
              </div>
            </div>
          )}
        </div>

        <div className="art-pilot-scrollbar min-h-0 overflow-y-auto px-5 py-5">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {prompt.categories.length > 0 ? (
              prompt.categories.map((category) => (
                <span className="rounded-md bg-fill-hover px-2 py-1 text-base font-medium text-text-muted" key={category}>
                  {category}
                </span>
              ))
            ) : (
              <span className="rounded-md bg-fill-hover px-2 py-1 text-base font-medium text-text-muted">未分类</span>
            )}
          </div>

          <h1 className="text-[22px] font-semibold leading-7 text-text-strong">{prompt.title}</h1>

          {prompt.description ? (
            <p className="mt-3 text-base leading-6 text-text-muted">{prompt.description}</p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <InfoTile label="来源" value={getSourceSiteLabel(prompt.sourceSite)} />
            <InfoTile label="更新时间" value={formatDate(prompt.updatedAt)} />
            <InfoTile label="作者" value={prompt.sourceAuthor ?? '未知'} />
            <InfoTile label="语言" value={prompt.originalLanguage?.toUpperCase() ?? '未知'} />
          </div>

          {prompt.previewImages.length > 1 ? (
            <div className="mt-5">
              <div className="mb-2 text-base font-semibold text-text-strong">预览图</div>
              <div className="grid grid-cols-4 gap-2">
                {prompt.previewImages.map((image, index) => (
                  <button
                    aria-label={`选择预览图 ${index + 1}`}
                    className={cn(
                      'aspect-square overflow-hidden rounded-lg border bg-background-subtle transition-colors',
                      index === selectedImageIndex ? 'border-text-strong' : 'border-border hover:border-border-hover',
                    )}
                    key={`${image.url}-${index}`}
                    onClick={() => onSelectImage(index)}
                    type="button"
                  >
                    <img
                      alt={image.alt ?? `${prompt.title} 预览图 ${index + 1}`}
                      className="size-full object-cover"
                      src={image.url}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="gap-1.5" onClick={onCopy}>
              {copied ? <Check className="size-3.5" strokeWidth={1.8} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
              {copied ? '已复制' : '复制提示词'}
            </Button>
            {prompt.originalSourceUrl ? (
              <button
                className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-base font-semibold text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
                type="button"
                onClick={onOpenOriginalSource}
              >
                <ExternalLink className="size-3.5" strokeWidth={1.8} />
                原始来源
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section className="max-h-[32vh] min-h-[180px] border-t border-border px-5 py-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text-strong">Prompt</h2>
          <span className="text-base text-text-muted">{prompt.content.length} 字符</span>
        </div>
        <pre className="art-pilot-scrollbar h-[calc(100%-28px)] overflow-y-auto whitespace-pre-wrap rounded-lg bg-background-subtle p-4 text-base leading-6 text-text-strong">
          {prompt.content}
        </pre>
      </section>

      {detailImagePreview.isOpen && detailImagePreview.previewImage ? (
        <ImagePreviewOverlay
          currentPosition={detailImagePreview.currentPosition}
          image={detailImagePreview.previewImage}
          imageCount={detailImagePreview.imageCount}
          prompt={prompt.title}
          zoom={detailImagePreview.zoom}
          onClose={detailImagePreview.closePreview}
          onNext={detailImagePreview.showNext}
          onPrevious={detailImagePreview.showPrevious}
          onResetZoom={detailImagePreview.resetZoom}
          onZoomByDelta={detailImagePreview.zoomByDelta}
          onZoomIn={detailImagePreview.zoomIn}
          onZoomOut={detailImagePreview.zoomOut}
        />
      ) : null}
    </article>
  )
}

function PromptListItem({
  copied,
  isSelected,
  prompt,
  previewItem,
  onCopy,
  onPreviewImage,
  onSelect,
}: {
  copied: boolean
  isSelected: boolean
  prompt: PromptRecord
  previewItem?: PromptPreviewListItem
  onCopy: () => void
  onPreviewImage: (image: PromptPreviewListItem) => void
  onSelect: () => void
}) {
  const previewImage = prompt.previewImages[0]

  return (
    <article
      className={cn(
        'group relative w-full rounded-lg border p-2 text-left transition-colors',
        isSelected ? 'border-border-hover bg-background-solid-hover' : 'border-transparent bg-fill hover:bg-background-solid-hover',
      )}
    >
      <button
        aria-label={copied ? '已复制 Prompt' : '复制 Prompt'}
        className={cn(
          'absolute right-2 top-2 z-10 inline-flex size-7 cursor-pointer items-center justify-center rounded-md border border-border bg-background-solid text-text-muted opacity-0 shadow-sm transition hover:text-text-strong group-hover:opacity-100',
          copied && 'opacity-100 text-text-success',
        )}
        type="button"
        onClick={onCopy}
      >
        {copied ? <Check className="size-3.5" strokeWidth={1.8} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
      </button>
      <div className="flex gap-3">
        {previewImage && previewItem ? (
          <button
            aria-label={`预览 ${prompt.title}`}
            className="h-24 w-28 shrink-0 cursor-zoom-in overflow-hidden rounded-lg bg-background-subtle"
            type="button"
            onClick={() => onPreviewImage(previewItem)}
          >
            <img
              alt={previewImage.alt ?? prompt.title}
              className="size-full object-cover transition-transform duration-150 hover:scale-[1.03]"
              src={previewImage.url}
            />
          </button>
        ) : previewImage ? (
          <img
            alt={previewImage.alt ?? prompt.title}
            className="h-24 w-28 shrink-0 rounded-lg bg-background-subtle object-cover"
            src={previewImage.url}
          />
        ) : (
          <div className="flex h-24 w-28 shrink-0 items-center justify-center rounded-lg bg-background-subtle text-text-muted">
            <MessageSquareText className="size-5" strokeWidth={1.8} />
          </div>
        )}
        <button className="min-w-0 flex-1 py-0.5 pr-8 text-left" type="button" onClick={onSelect}>
          <h2 className="line-clamp-2 text-base font-semibold text-text-strong">{prompt.title}</h2>
          <p className="mt-1 line-clamp-2 text-base text-text-muted">{prompt.description || prompt.content}</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            {prompt.categories.slice(0, 3).map((category) => (
              <span className="rounded-md bg-fill-hover px-1.5 py-0.5 text-[11px] leading-4 text-text-muted" key={category}>
                {category}
              </span>
            ))}
          </div>
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-base text-text-muted">
        <span>{getSourceSiteLabel(prompt.sourceSite)}</span>
        <span>{formatDate(prompt.updatedAt)}</span>
      </div>
    </article>
  )
}

function PromptGalleryView({
  copiedPromptId,
  filterOptions,
  filters,
  loading,
  prompts,
  promptsCount,
  onCopy,
  onCreatePrompt,
  onFiltersChange,
  onShowPromptInList,
}: {
  copiedPromptId: string | null
  filterOptions: GalleryFilterOptions
  filters: GalleryFilters
  loading: boolean
  prompts: PromptRecord[]
  promptsCount: number
  onCopy: (prompt: PromptRecord) => void
  onCreatePrompt: () => void
  onFiltersChange: (filters: GalleryFilters) => void
  onShowPromptInList: (prompt: PromptRecord) => void
}) {
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const galleryPreviewImages = useMemo<PromptPreviewListItem[]>(() => {
    return prompts.flatMap((prompt, promptIndex) => {
      const previewImage = prompt.previewImages[0]

      if (!previewImage) {
        return []
      }

      return [{
        imageUrl: previewImage.url,
        index: promptIndex,
        promptId: prompt.id,
        promptTitle: prompt.title,
      }]
    })
  }, [prompts])
  const galleryImagePreview = useImagePreview(galleryPreviewImages)

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-background-solid">
      <PromptGalleryFilters
        collapsed={filtersCollapsed}
        filterOptions={filterOptions}
        filters={filters}
        onCollapsedChange={setFiltersCollapsed}
        onFiltersChange={onFiltersChange}
      />

      <div className="art-pilot-scrollbar min-h-0 flex-1 overflow-y-auto bg-background-subtle px-4 py-4">
        {loading ? (
          <EmptyState icon={MessageSquareText} title="正在读取提示词" description="稍候片刻" />
        ) : prompts.length > 0 ? (
          <div className="columns-2 gap-4 xl:columns-3 2xl:columns-4">
            {prompts.map((prompt, promptIndex) => (
              <PromptGalleryCard
                copied={copiedPromptId === prompt.id}
                key={prompt.id}
                prompt={prompt}
                previewItem={galleryPreviewImages.find((image) => image.promptId === prompt.id)}
                variantIndex={promptIndex}
                onCopy={() => onCopy(prompt)}
                onPreviewImage={galleryImagePreview.openPreview}
                onShowPrompt={() => onShowPromptInList(prompt)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            action={promptsCount > 0 ? undefined : {
              label: '新建提示词',
              onClick: onCreatePrompt,
            }}
            icon={Images}
            title={promptsCount > 0 ? '没有匹配结果' : '暂无提示词'}
            description={promptsCount > 0 ? '调整关键词或筛选条件试试' : '你可以手动创建常用的提示词，或从外部导入。'}
          />
        )}
      </div>

      {galleryImagePreview.isOpen && galleryImagePreview.previewImage ? (
        <ImagePreviewOverlay
          currentPosition={galleryImagePreview.currentPosition}
          image={galleryImagePreview.previewImage}
          imageCount={galleryImagePreview.imageCount}
          prompt={galleryImagePreview.previewImage.promptTitle}
          zoom={galleryImagePreview.zoom}
          onClose={galleryImagePreview.closePreview}
          onNext={galleryImagePreview.showNext}
          onPrevious={galleryImagePreview.showPrevious}
          onResetZoom={galleryImagePreview.resetZoom}
          onZoomByDelta={galleryImagePreview.zoomByDelta}
          onZoomIn={galleryImagePreview.zoomIn}
          onZoomOut={galleryImagePreview.zoomOut}
        />
      ) : null}
    </div>
  )
}

function PromptGalleryFilters({
  collapsed,
  filterOptions,
  filters,
  onCollapsedChange,
  onFiltersChange,
}: {
  collapsed: boolean
  filterOptions: GalleryFilterOptions
  filters: GalleryFilters
  onCollapsedChange: (collapsed: boolean) => void
  onFiltersChange: (filters: GalleryFilters) => void
}) {
  const activeFilterCount = getActiveGalleryFilterCount(filters)
  const ToggleIcon = collapsed ? ChevronDown : ChevronUp

  return (
    <div className="shrink-0 border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-3.5 shrink-0 text-text-muted" strokeWidth={1.8} />
          <span className="text-base font-semibold text-text-strong">筛选</span>
          {activeFilterCount > 0 ? (
            <span className="rounded-md bg-fill-hover px-1.5 py-0.5 text-[11px] font-medium leading-4 text-text-muted">
              {activeFilterCount} 项
            </span>
          ) : null}
        </div>
        <button
          aria-expanded={!collapsed}
          aria-label={collapsed ? '展开筛选栏' : '收起筛选栏'}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <ToggleIcon className="size-4" strokeWidth={1.8} />
        </button>
      </div>

      {collapsed ? null : (
        <div className="mt-3 space-y-3">
          <FilterRow label="分类">
            <FilterChip
              active={filters.category === null}
              label="全部"
              onClick={() => onFiltersChange({ ...filters, category: null })}
            />
            {filterOptions.categories.map((category) => (
              <FilterChip
                active={filters.category === category}
                key={category}
                label={category}
                onClick={() => onFiltersChange({ ...filters, category })}
              />
            ))}
          </FilterRow>

          <FilterRow label="来源">
            <FilterChip
              active={filters.sourceSite === 'all'}
              label="全部"
              onClick={() => onFiltersChange({ ...filters, sourceSite: 'all' })}
            />
            {filterOptions.sourceSites.map((sourceSite) => (
              <FilterChip
                active={filters.sourceSite === sourceSite}
                key={sourceSite}
                label={getSourceSiteLabel(sourceSite)}
                onClick={() => onFiltersChange({ ...filters, sourceSite })}
              />
            ))}
          </FilterRow>

          <FilterRow label="语言">
            <FilterChip
              active={filters.language === 'all'}
              label="全部"
              onClick={() => onFiltersChange({ ...filters, language: 'all' })}
            />
            {filterOptions.languages.map((language) => (
              <FilterChip
                active={filters.language === language}
                key={language}
                label={language.toUpperCase()}
                onClick={() => onFiltersChange({ ...filters, language })}
              />
            ))}
          </FilterRow>

          <FilterRow label="图片">
            <FilterChip
              active={filters.imageState === 'all'}
              label="全部"
              onClick={() => onFiltersChange({ ...filters, imageState: 'all' })}
            />
            <FilterChip
              active={filters.imageState === 'withImage'}
              label="有图"
              onClick={() => onFiltersChange({ ...filters, imageState: 'withImage' })}
            />
          </FilterRow>
        </div>
      )}
    </div>
  )
}

function FilterRow({ children, label }: { children: React.ReactNode, label: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <div className="w-8 shrink-0 py-1 text-base font-semibold text-text-muted">{label}</div>
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">{children}</div>
    </div>
  )
}

function FilterChip({
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
      aria-pressed={active}
      className={cn(
        'h-7 cursor-pointer rounded-lg border px-2.5 text-base font-semibold transition-colors',
        active
          ? 'border-text-strong bg-text-strong text-background-solid'
          : 'border-border bg-fill text-text-muted hover:border-border-hover hover:text-text-strong',
      )}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function PromptGalleryCard({
  copied,
  prompt,
  previewItem,
  variantIndex,
  onCopy,
  onPreviewImage,
  onShowPrompt,
}: {
  copied: boolean
  prompt: PromptRecord
  previewItem?: PromptPreviewListItem
  variantIndex: number
  onCopy: () => void
  onPreviewImage: (image: PromptPreviewListItem) => void
  onShowPrompt: () => void
}) {
  const previewImage = prompt.previewImages[0]

  return (
    <article className="mb-4 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border border-border bg-background-solid shadow-sm">
      {previewImage && previewItem ? (
        <button
          aria-label={`预览 ${prompt.title}`}
          className="block w-full cursor-zoom-in overflow-hidden bg-fill"
          type="button"
          onClick={() => onPreviewImage(previewItem)}
        >
          <img
            alt={previewImage.alt ?? prompt.title}
            className={cn('w-full object-cover transition-transform duration-150 hover:scale-[1.02]', getGalleryImageHeightClass(variantIndex))}
            src={previewImage.url}
          />
        </button>
      ) : (
        <button
          className={cn(
            'flex w-full cursor-pointer flex-col items-center justify-center gap-2 bg-fill-hover text-text-muted',
            getGalleryPlaceholderHeightClass(variantIndex),
          )}
          type="button"
          onClick={onShowPrompt}
        >
          <ImageOff className="size-6" strokeWidth={1.8} />
          <span className="text-base font-medium">没有预览图</span>
        </button>
      )}

      <div className="p-3">
        <button className="block w-full text-left" type="button" onClick={onShowPrompt}>
          <h2 className="line-clamp-2 text-base font-semibold text-text-strong">{prompt.title}</h2>
          <p className="mt-1 line-clamp-2 text-base leading-5 text-text-muted">{prompt.description || prompt.content}</p>
        </button>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(prompt.categories.length > 0 ? prompt.categories.slice(0, 3) : ['未分类']).map((category) => (
            <span className="rounded-md bg-fill-hover px-1.5 py-0.5 text-[11px] leading-4 text-text-muted" key={category}>
              {category}
            </span>
          ))}
        </div>

        <Button className="mt-3 gap-1.5" display="block" onClick={onCopy}>
          {copied ? <Check className="size-3.5" strokeWidth={1.8} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
          {copied ? '已复制' : '复制 Prompt'}
        </Button>
      </div>
    </article>
  )
}

function CreatePromptDialog({
  saving,
  onClose,
  onSave,
}: {
  saving: boolean
  onClose: () => void
  onSave: (request: SavePromptRequest) => void
}) {
  const [mode, setMode] = useState<'manual' | 'url'>('manual')
  const [importUrl, setImportUrl] = useState('')
  const [importDraft, setImportDraft] = useState<PromptImportDraft | null>(null)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [categories, setCategories] = useState('')
  const [previewImages, setPreviewImages] = useState<PromptImportDraft['previewImages']>([])
  const canSave = title.trim().length > 0 && content.trim().length > 0 && !saving

  async function previewImport() {
    setImporting(true)
    setImportError(null)

    try {
      const draft = await window.api.previewPromptImport(importUrl)
      setImportDraft(draft)
      setTitle(draft.title)
      setDescription(draft.description ?? '')
      setContent(draft.content)
      setCategories(draft.categories.join(', '))
      setPreviewImages(draft.previewImages)
    } catch (error) {
      setImportError(getErrorMessage(error))
    } finally {
      setImporting(false)
    }
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSave) {
      return
    }

    const sourceDraft = mode === 'url' ? importDraft : null

    onSave({
      title,
      description,
      content,
      sourceSite: sourceDraft?.sourceSite ?? 'manual',
      sourceUrl: sourceDraft?.sourceUrl,
      sourceAuthor: sourceDraft?.sourceAuthor,
      originalSourceUrl: sourceDraft?.originalSourceUrl,
      originalLanguage: sourceDraft?.originalLanguage,
      categories: parseCategoryInput(categories),
      previewImages: mode === 'url' ? previewImages : [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6 py-6">
      <form className="flex max-h-full w-full max-w-2xl flex-col rounded-lg border border-border bg-background-solid shadow-xl" onSubmit={submitForm}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-text-strong">新建提示词</h2>
            <p className="mt-1 text-base text-text-muted">保存常用提示词，之后可以在库里快速查找和复制。</p>
          </div>
          <button
            aria-label="关闭"
            className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
            disabled={saving}
            type="button"
            onClick={onClose}
          >
            <X className="size-4" strokeWidth={1.8} />
          </button>
        </header>

        <div className="art-pilot-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="flex rounded-lg bg-fill-hover p-0.5">
            <button
              aria-pressed={mode === 'manual'}
              className={cn(
                'h-8 flex-1 cursor-pointer rounded-md px-3 text-base font-semibold transition-colors',
                mode === 'manual' ? 'bg-background-solid text-text-strong shadow-sm' : 'text-text-muted hover:text-text-strong',
              )}
              type="button"
              onClick={() => setMode('manual')}
            >
              手动创建
            </button>
            <button
              aria-pressed={mode === 'url'}
              className={cn(
                'h-8 flex-1 cursor-pointer rounded-md px-3 text-base font-semibold transition-colors',
                mode === 'url' ? 'bg-background-solid text-text-strong shadow-sm' : 'text-text-muted hover:text-text-strong',
              )}
              type="button"
              onClick={() => setMode('url')}
            >
              从 URL 导入
            </button>
          </div>

          {mode === 'url' ? (
            <div className="rounded-lg border border-border bg-background-subtle p-3">
              <label className="block">
                <span className="mb-1.5 block text-base font-semibold text-text-strong">提示词链接</span>
                <div className="flex gap-2">
                  <Input
                    placeholder="粘贴 YouMind 提示词详情页链接"
                    value={importUrl}
                    onChange={(event) => setImportUrl(event.target.value)}
                  />
                  <Button className="shrink-0" disabled={importing || !importUrl.trim()} onClick={() => void previewImport()}>
                    {importing ? '获取中...' : '获取预览'}
                  </Button>
                </div>
              </label>
              {importError ? <p className="mt-2 text-base text-text-error">{importError}</p> : null}
              {importDraft ? (
                <div className="mt-3 flex flex-wrap gap-2 text-base text-text-muted">
                  <span className="rounded-md bg-fill-hover px-2 py-1">来源：{getSourceSiteLabel(importDraft.sourceSite)}</span>
                  {importDraft.sourceAuthor ? <span className="rounded-md bg-fill-hover px-2 py-1">作者：{importDraft.sourceAuthor}</span> : null}
                  {importDraft.previewImages.length > 0 ? <span className="rounded-md bg-fill-hover px-2 py-1">{importDraft.previewImages.length} 张预览图</span> : null}
                  {importDraft.categories.length > 0 ? <span className="rounded-md bg-fill-hover px-2 py-1">{importDraft.categories.length} 个分类</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {previewImages.length > 0 ? (
            <div>
              <div className="mb-2 text-base font-semibold text-text-strong">预览图</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {previewImages.map((image, index) => (
                  <div className="aspect-square overflow-hidden rounded-lg bg-fill" key={`${image.url}-${index}`}>
                    <img
                      alt={image.alt ?? `预览图 ${index + 1}`}
                      className="size-full object-cover"
                      src={image.url}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-base font-semibold text-text-strong">标题</span>
            <Input
              autoFocus
              placeholder="例如：产品海报背景生成"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-base font-semibold text-text-strong">描述</span>
            <Input
              placeholder="可选，用来说明适用场景"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-base font-semibold text-text-strong">Prompt</span>
            <textarea
              className="min-h-48 w-full resize-y rounded-lg border border-border bg-fill px-3 py-2 text-base font-medium leading-6 text-text-strong outline-none transition-colors placeholder:text-text-muted focus:border-border-hover disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="输入要保存的提示词内容"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-base font-semibold text-text-strong">分类</span>
            <Input
              placeholder="可选，用逗号分隔，例如：海报, 电商, 写实"
              value={categories}
              onChange={(event) => setCategories(event.target.value)}
            />
          </label>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-4">
          <Button disabled={saving} variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button className="gap-1.5 bg-text-strong text-background-solid hover:bg-text-muted" disabled={!canSave} type="submit">
            <Plus className="size-3.5" strokeWidth={1.8} />
            {saving ? '保存中...' : '保存提示词'}
          </Button>
        </footer>
      </form>
    </div>
  )
}

function InfoTile({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-lg bg-background-subtle px-3 py-2">
      <div className="text-[11px] font-medium leading-4 text-text-muted">{label}</div>
      <div className="mt-0.5 line-clamp-1 text-base font-semibold text-text-strong">{value}</div>
    </div>
  )
}

function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: {
    label: string
    onClick: () => void
  }
  description: string
  icon: LucideIcon
  title: string
}) {
  return (
    <div className="flex h-full min-h-[220px] items-center justify-center px-8 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-fill-hover text-text-strong">
          <Icon className="size-5" strokeWidth={1.8} />
        </div>
        <h2 className="text-base font-semibold text-text-strong">{title}</h2>
        <p className="mt-1 text-base text-text-muted">{description}</p>
        {action ? (
          <Button className="mt-4 gap-1.5 bg-text-strong text-background-solid hover:bg-text-muted" onClick={action.onClick}>
            <Plus className="size-3.5" strokeWidth={1.8} />
            {action.label}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

type GalleryFilterOptions = {
  categories: string[]
  languages: string[]
  sourceSites: PromptRecord['sourceSite'][]
}

function getGalleryFilterOptions(prompts: PromptRecord[]): GalleryFilterOptions {
  return {
    categories: Array.from(new Set(prompts.flatMap((prompt) => prompt.categories))).sort(),
    languages: Array.from(new Set(prompts.map((prompt) => prompt.originalLanguage).filter(isNonEmptyString))).sort(),
    sourceSites: Array.from(new Set(prompts.map((prompt) => prompt.sourceSite))).sort(),
  }
}

function getActiveGalleryFilterCount(filters: GalleryFilters) {
  return [
    filters.category !== null,
    filters.sourceSite !== 'all',
    filters.language !== 'all',
    filters.imageState !== 'all',
  ].filter(Boolean).length
}

function getGalleryImageHeightClass(index: number) {
  return ['h-72', 'h-56', 'h-80', 'h-64'][index % 4]
}

function getGalleryPlaceholderHeightClass(index: number) {
  return ['h-52', 'h-44', 'h-60', 'h-48'][index % 4]
}

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function parseCategoryInput(value: string) {
  return [...new Set(value.split(/[,，]/).map((category) => category.trim()).filter(Boolean))]
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function getSourceSiteLabel(sourceSite: PromptRecord['sourceSite']) {
  return sourceSite === 'youmind' ? 'YouMind' : '手动'
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
