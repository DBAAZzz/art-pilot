import { Check, Copy, ExternalLink, ImageOff, Pencil, Plus } from 'lucide-react'
import type { PromptRecord } from '@art-pilot/shared'
import { useMemo } from 'react'

import { Button } from '@/components/Button'
import { ImagePreviewOverlay } from '@/components/ImagePreviewOverlay'
import { useImagePreview } from '@/hooks/useImagePreview'
import { cn } from '@/lib/utils'

type PromptDetailProps = {
  copied: boolean
  prompt: PromptRecord
  selectedImageIndex: number
  selectedPreviewImage?: PromptRecord['previewImages'][number]
  onCopy: () => void
  onEdit?: () => void
  onOpenOriginalSource: () => void
  onSelectImage: (index: number) => void
  onUse: () => void
}

export function PromptDetail({
  copied,
  prompt,
  selectedImageIndex,
  selectedPreviewImage,
  onCopy,
  onEdit,
  onOpenOriginalSource,
  onSelectImage,
  onUse,
}: PromptDetailProps) {
  const detailPreviewImages = useMemo(() => {
    return prompt.previewImages.map((image, index) => ({
      imageUrl: getHighResolutionPreviewUrl(image.url),
      index,
    }))
  }, [prompt.previewImages])
  const detailImagePreview = useImagePreview(detailPreviewImages)

  return (
    <article className="flex h-full min-h-0 flex-col bg-background-solid">
      <header className="shrink-0 px-7 pb-5 pt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-title font-semibold leading-7 text-text-strong">{prompt.title}</h1>
            {prompt.description ? (
              <p className="mt-2 max-w-3xl text-base leading-6 text-text-muted">{prompt.description}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <Button className="gap-1.5 bg-text-strong text-background-solid hover:bg-text-muted" onClick={onUse}>
              <Plus className="size-3.5" strokeWidth={1.8} />
              使用模板
            </Button>
            <Button className="gap-1.5" onClick={onCopy}>
              {copied ? <Check className="size-3.5" strokeWidth={1.8} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
              {copied ? '已复制' : '复制'}
            </Button>
            {onEdit ? (
              <Button className="gap-1.5" onClick={onEdit}>
                <Pencil className="size-3.5" strokeWidth={1.8} />
                编辑
              </Button>
            ) : null}
            {prompt.originalSourceUrl ? (
              <button
                aria-label="打开原始来源"
                className="inline-flex size-8 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
                title="原始来源"
                type="button"
                onClick={onOpenOriginalSource}
              >
                <ExternalLink className="size-3.5" strokeWidth={1.8} />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="art-pilot-scrollbar min-h-0 flex-1 overflow-y-auto px-7 pb-7">
        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-w-0">
            {selectedPreviewImage ? (
              <button
                aria-label="预览当前提示词图片"
                className="flex aspect-[4/3] w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-lg bg-fill"
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
                  className="size-full object-contain"
                  src={getHighResolutionPreviewUrl(selectedPreviewImage.url)}
                />
              </button>
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-fill text-text-muted">
                <div className="flex flex-col items-center gap-3 text-center">
                  <ImageOff className="size-8" strokeWidth={1.8} />
                  <span className="text-base">没有预览图</span>
                </div>
              </div>
            )}

            {prompt.previewImages.length > 1 ? (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {prompt.previewImages.map((image, index) => (
                  <button
                    aria-label={`选择预览图 ${index + 1}`}
                    className={cn(
                      'aspect-square cursor-pointer overflow-hidden rounded-lg bg-background-subtle transition-colors',
                      index === selectedImageIndex ? 'bg-fill-hover' : 'hover:bg-fill-hover',
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
            ) : null}
          </div>

          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(prompt.categories.length > 0 ? prompt.categories : ['未分类']).map((category) => (
                <span className="rounded-md bg-fill-hover px-2 py-1 text-base font-medium text-text-muted" key={category}>
                  {category}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <InfoTile label="来源" value={getSourceSiteLabel(prompt.sourceSite)} />
              <InfoTile label="更新时间" value={formatDate(prompt.updatedAt)} />
              <InfoTile label="作者" value={prompt.sourceAuthor ?? '未知'} />
              <InfoTile label="语言" value={prompt.originalLanguage?.toUpperCase() ?? '未知'} />
            </div>
          </div>
        </div>

        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-text-strong">Prompt</h2>
            <span className="text-base text-text-muted">{prompt.content.length} 字符</span>
          </div>
          <div className="whitespace-pre-wrap rounded-lg bg-background-subtle p-4 text-base leading-6 text-text-strong">
            <PromptContentWithVariables content={prompt.content} />
          </div>
        </section>
      </div>

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

function PromptContentWithVariables({ content }: { content: string }) {
  const parts = content.split(/(\{\{[^{}]+\}\})/g)

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('{{') && part.endsWith('}}')) {
          return (
            <span className="rounded-md bg-fill-hover px-1 font-semibold text-text-strong" key={`${part}-${index}`}>
              {part}
            </span>
          )
        }

        return <span key={`${part}-${index}`}>{part}</span>
      })}
    </>
  )
}

function InfoTile({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-lg bg-background-subtle px-3 py-2">
      <div className="text-base font-medium leading-4 text-text-muted">{label}</div>
      <div className="mt-0.5 line-clamp-1 text-base font-semibold text-text-strong">{value}</div>
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

function getHighResolutionPreviewUrl(previewUrl: string) {
  try {
    const url = new URL(previewUrl)

    if (url.protocol === 'artpilot-image:' && url.hostname === 'asset-thumbnail') {
      return `artpilot-image://asset-original${url.pathname}`
    }
  } catch {
    return previewUrl
  }

  return previewUrl
}
