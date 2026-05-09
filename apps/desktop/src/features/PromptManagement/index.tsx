import {
  Check,
  Copy,
  MessageSquareText,
  Plus,
  Search,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { PromptRecord } from '@art-pilot/shared'
import { useNavigate } from 'react-router'

import { Button } from '@/components/Button'
import { ImagePreviewOverlay } from '@/components/ImagePreviewOverlay'
import { Input } from '@/components/Input'
import { useApiRequest } from '@/hooks/useApiRequest'
import { useImagePreview } from '@/hooks/useImagePreview'
import { getErrorMessage } from '@/hooks/useLoadingState'
import { cn } from '@/lib/utils'
import { PromptDetail } from './components/PromptDetail'

type PromptPreviewListItem = {
  imageUrl: string
  index: number
  promptId: string
  promptTitle: string
}

export function PromptManagementPage() {
  const navigate = useNavigate()
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [query, setQuery] = useState('')
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const listPromptTemplates = useCallback(() => window.api.listPromptTemplates(), [])
  const {
    data: prompts,
    error,
    execute: fetchPrompts,
    loading,
    setError,
  } = useApiRequest(listPromptTemplates, {
    initialData: [] as PromptRecord[],
    initialLoading: true,
  })

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

      return matchesQuery
    })
  }, [prompts, query])

  const selectedPrompt = useMemo(() => {
    return filteredPrompts.find((prompt) => prompt.id === selectedPromptId) ?? filteredPrompts[0] ?? null
  }, [filteredPrompts, selectedPromptId])

  const selectedPreviewImage = selectedPrompt?.previewImages[selectedImageIndex] ?? selectedPrompt?.previewImages[0]
  const filteredCountLabel = `${filteredPrompts.length} / ${prompts.length} 条`
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
    const promptRecords = await fetchPrompts()
    if (promptRecords) {
      setSelectedPromptId((currentId) => currentId ?? promptRecords[0]?.id ?? null)
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

  function useTemplateDirectly(templateId: string) {
    navigate('/', {
      state: {
        promptTemplateUse: {
          templateId,
        },
      },
    })
  }

  return (
    <section className="col-span-2 grid min-h-0 grid-cols-[360px_minmax(0,1fr)] bg-background-solid">
      {error ? (
        <div className="absolute left-5 right-5 top-5 z-20 rounded-lg bg-background-subtle px-4 py-2 text-base text-text-error">
          {error}
        </div>
      ) : null}

        <PromptLibraryPane
          copiedPromptId={copiedPromptId}
          countLabel={filteredCountLabel}
          filteredPrompts={filteredPrompts}
          listImagePreview={listImagePreview}
          listPreviewImages={listPreviewImages}
          loading={loading}
          promptsCount={prompts.length}
          query={query}
          selectedPrompt={selectedPrompt}
          onCopy={(prompt) => void copyPrompt(prompt)}
          onCreatePrompt={() => void navigate('/prompts/new')}
          onQueryChange={setQuery}
          onSelectPrompt={setSelectedPromptId}
        />

      <div className="min-h-0 bg-background-solid shadow-[-1px_0_0_var(--border)]">
        {selectedPrompt ? (
          <PromptDetail
            copied={copiedPromptId === selectedPrompt.id}
            prompt={selectedPrompt}
            selectedImageIndex={selectedImageIndex}
            selectedPreviewImage={selectedPreviewImage}
            onCopy={() => void copyPrompt(selectedPrompt)}
            onEdit={() => void navigate(`/prompts/${encodeURIComponent(selectedPrompt.id)}/edit`)}
            onOpenOriginalSource={() => void openOriginalSource(selectedPrompt)}
            onSelectImage={setSelectedImageIndex}
            onUse={() => useTemplateDirectly(selectedPrompt.id)}
          />
        ) : (
          <EmptyState icon={MessageSquareText} title="选择一个提示词" description="已保存模板会在这里显示预览图和内容" />
        )}
      </div>

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

function PromptLibraryPane({
  copiedPromptId,
  countLabel,
  filteredPrompts,
  listImagePreview,
  listPreviewImages,
  loading,
  promptsCount,
  query,
  selectedPrompt,
  onCopy,
  onCreatePrompt,
  onQueryChange,
  onSelectPrompt,
}: {
  copiedPromptId: string | null
  countLabel: string
  filteredPrompts: PromptRecord[]
  listImagePreview: ReturnType<typeof useImagePreview<PromptPreviewListItem>>
  listPreviewImages: PromptPreviewListItem[]
  loading: boolean
  promptsCount: number
  query: string
  selectedPrompt: PromptRecord | null
  onCopy: (prompt: PromptRecord) => void
  onCreatePrompt: () => void
  onQueryChange: (query: string) => void
  onSelectPrompt: (promptId: string) => void
}) {
  return (
    <aside className="flex min-h-0 flex-col bg-background-solid">
      <div className="shrink-0 px-5 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-background-subtle px-3 transition-colors">
            <Search className="size-3.5 shrink-0 text-text-muted" strokeWidth={1.8} />
            <Input
              className="h-8 border-0 bg-transparent px-0 focus:border-0"
              placeholder="搜索标题、分类、作者"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
          <Button className="shrink-0 gap-1.5 bg-text-strong text-background-solid hover:bg-text-muted" onClick={onCreatePrompt}>
            <Plus className="size-3.5" strokeWidth={1.8} />
            新建
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-base font-medium text-text-muted">{countLabel}</span>
        </div>
      </div>

      <div className="art-pilot-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-4">
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
            description={promptsCount > 0 ? '调整关键词或筛选条件试试' : '你可以手动创建模板，也可以用链接快速填充。'}
          />
        )}
      </div>
    </aside>
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
        'group relative w-full rounded-lg p-2 text-left transition-colors',
        isSelected ? 'bg-background-solid-hover' : 'bg-fill hover:bg-background-solid-hover',
      )}
    >
      <button
        aria-label={copied ? '已复制 Prompt' : '复制 Prompt'}
        className={cn(
          'absolute right-2 top-2 z-10 inline-flex size-7 cursor-pointer items-center justify-center rounded-md bg-background-solid text-text-muted opacity-0 transition hover:text-text-strong group-hover:opacity-100',
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
              <span className="rounded-md bg-fill-hover px-1.5 py-0.5 text-base leading-4 text-text-muted" key={category}>
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

function getSourceSiteLabel(sourceSite: PromptRecord['sourceSite']) {
  if (sourceSite === 'youmind') {
    return 'YouMind'
  }

  return sourceSite === 'other' ? '其他' : '手动'
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
