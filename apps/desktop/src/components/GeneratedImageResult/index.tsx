import { AlertCircle, Check, CircleX, ImageOff, ImagePlus, Loader2 } from 'lucide-react'

import { ImagePreviewOverlay } from '@/components/ImagePreviewOverlay'
import { cn } from '@/lib/utils'

import { useImagePreview } from './useImagePreview'

export type GeneratedImageResultStatus = 'running' | 'complete' | 'error' | 'cancelled'

export type GeneratedImageResultImage = {
  index: number
  imageUrl: string
  imagePath?: string
}

export function GeneratedImageResult({
  aspectRatio,
  className,
  completedAt,
  count,
  createdAt,
  error,
  images,
  message,
  onCancel,
  prompt,
  status,
}: {
  aspectRatio: string
  className?: string
  completedAt?: number
  count: number
  createdAt: number
  error?: string
  images: GeneratedImageResultImage[]
  message?: string
  onCancel?: () => void | Promise<void>
  prompt: string
  status: GeneratedImageResultStatus
}) {
  const imageSlots = createImageSlots(images, count)
  const imagePreview = useImagePreview(images)
  const shouldShowImageGrid = status === 'running' || images.length > 0

  return (
    <>
      <article className={cn('rounded-lg bg-fill p-3 transition-colors hover:bg-background-solid-hover', className)}>
        <div className="mb-3 min-w-0">
          <p className="line-clamp-2 min-w-0 text-base font-medium text-text-strong">{prompt}</p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 text-base text-text-muted">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
              <MetaLine value={aspectRatio} />
              <span>/</span>
              <MetaLine value={`${count}张`} />
              <span>/</span>
              <MetaLine label={completedAt ? '完成' : '创建'} value={formatCreatedAt(completedAt ?? createdAt)} />
            </div>
            <TaskAction status={status} onCancel={onCancel} />
          </div>
        </div>

        {message && status === 'running' ? <p className="mb-3 line-clamp-2 text-base text-text-muted">{message}</p> : null}
        {error ? <p className={cn('line-clamp-2 text-base text-text-error', shouldShowImageGrid && 'mb-3')}>{error}</p> : null}

        {shouldShowImageGrid ? (
          <div className={getImageGridClassName(imageSlots.length)}>
            {imageSlots.map((image, slotIndex) => (
              <div
                className={getImageSlotClassName(imageSlots.length)}
                key={image?.index ?? `placeholder-${slotIndex}`}
              >
                {image ? (
                  <button
                    aria-label={`预览图片 ${getImageDisplayIndex(image.index, images)}`}
                    className="block size-full cursor-pointer overflow-hidden rounded-lg"
                    type="button"
                    onClick={() => imagePreview.openPreview(image)}
                  >
                    <img
                      alt={`${prompt}，图片 ${getImageDisplayIndex(image.index, images)}`}
                      className="size-full object-cover transition-transform hover:scale-[1.02]"
                      src={image.imageUrl}
                    />
                  </button>
                ) : (
                  <div className="flex size-full items-center justify-center text-base text-text-muted">
                    <PlaceholderIcon status={status} />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </article>

      {imagePreview.isOpen && imagePreview.previewImage ? (
        <ImagePreviewOverlay
          currentPosition={imagePreview.currentPosition}
          image={imagePreview.previewImage}
          imageCount={imagePreview.imageCount}
          prompt={prompt}
          onClose={imagePreview.closePreview}
          onNext={imagePreview.showNext}
          onPrevious={imagePreview.showPrevious}
          onResetZoom={imagePreview.resetZoom}
          onZoomByDelta={imagePreview.zoomByDelta}
          onZoomIn={imagePreview.zoomIn}
          onZoomOut={imagePreview.zoomOut}
          zoom={imagePreview.zoom}
        />
      ) : null}
    </>
  )
}

function TaskAction({
  onCancel,
  status,
}: {
  onCancel?: () => void | Promise<void>
  status: GeneratedImageResultStatus
}) {
  if (status === 'running' && onCancel) {
    return (
      <button
        aria-label="取消生成任务"
        className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-base font-medium text-text-muted transition-colors hover:bg-fill-hover hover:text-text-error"
        type="button"
        onClick={() => {
          void onCancel()
        }}
      >
        <CircleX className="size-3.5" strokeWidth={1.8} />
        <span>取消生成</span>
      </button>
    )
  }

  return <StatusBadge status={status} />
}

function StatusBadge({ status }: { status: GeneratedImageResultStatus }) {
  const shouldShowIcon = status !== 'running'

  return (
    <div
      aria-label={getStatusText(status)}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg bg-fill-hover px-2 text-base text-text-muted"
      title={getStatusText(status)}
    >
      {shouldShowIcon ? <StatusIcon status={status} /> : null}
      <span>{getStatusText(status)}</span>
    </div>
  )
}

function StatusIcon({ status }: { status: GeneratedImageResultStatus }) {
  if (status === 'complete') {
    return <Check className="size-3.5 text-text-success" strokeWidth={1.9} />
  }

  if (status === 'error') {
    return <AlertCircle className="size-3.5 text-text-error" strokeWidth={1.8} />
  }

  return <CircleX className="size-3.5" strokeWidth={1.8} />
}

function PlaceholderIcon({ status }: { status: GeneratedImageResultStatus }) {
  if (status === 'running') {
    return <Loader2 className="size-5 animate-spin" strokeWidth={1.8} />
  }

  if (status === 'error' || status === 'cancelled') {
    return <ImageOff className="size-5" strokeWidth={1.8} />
  }

  return <ImagePlus className="size-5" strokeWidth={1.8} />
}

function MetaLine({ label, value }: { label?: string; value: string }) {
  return (
    <span className="text-text-muted">{label ? `${label} ` : null}<span className="text-text-strong">{value}</span></span>
  )
}

function getStatusText(status: GeneratedImageResultStatus) {
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

function createImageSlots(images: GeneratedImageResultImage[], count: number) {
  const imageByIndex = new Map(images.map((image) => [image.index, image]))
  const firstSlotIndex = getFirstSlotIndex(images)
  const slotCount = Math.max(count, images.length, 1)

  return Array.from({ length: slotCount }, (_, slotOffset) => imageByIndex.get(firstSlotIndex + slotOffset))
}

function getFirstSlotIndex(images: GeneratedImageResultImage[]) {
  return images.some((image) => image.index === 0) ? 0 : 1
}

function getImageDisplayIndex(index: number, images: GeneratedImageResultImage[]) {
  return getFirstSlotIndex(images) === 0 ? index + 1 : index
}

function getImageGridClassName(slotCount: number) {
  if (slotCount === 1) {
    return 'grid w-full max-w-[360px] grid-cols-1 gap-2'
  }

  return 'grid w-full max-w-[360px] grid-cols-2 gap-2'
}

function getImageSlotClassName(slotCount: number) {
  if (slotCount === 1) {
    return 'aspect-[4/3] w-full overflow-hidden rounded-lg bg-background-subtle'
  }

  return 'aspect-square w-full overflow-hidden rounded-lg bg-background-subtle'
}

function formatCreatedAt(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
