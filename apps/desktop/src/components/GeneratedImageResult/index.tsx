import { CircleAlert, CircleCheck, CircleX, FolderOpen, ImageOff, ImagePlus, Loader2 } from 'lucide-react'
import type { ImageReference } from '@art-pilot/shared'
import { useMemo } from 'react'

import { ImagePreviewOverlay } from '@/components/ImagePreviewOverlay'
import type { ImagePreviewItem } from '@/hooks/useImagePreview'
import { useImagePreview } from '@/hooks/useImagePreview'
import { cn } from '@/lib/utils'

export type GeneratedImageResultStatus = 'running' | 'complete' | 'error' | 'cancelled'

export type GeneratedImageResultImage = ImagePreviewItem

export function GeneratedImageResult({
  className,
  count,
  createdAt,
  error,
  images,
  message,
  onCancel,
  onOpenImageLocation,
  prompt,
  references = [],
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
  onOpenImageLocation?: (image: GeneratedImageResultImage) => void | Promise<void>
  prompt: string
  references?: ImageReference[]
  status: GeneratedImageResultStatus
}) {
  const imageSlots = createImageSlots(images, count)
  const imagePreview = useImagePreview(images)
  const referencePreviewImages = useMemo(
    () => createReferencePreviewImages(references),
    [references],
  )
  const referencePreview = useImagePreview(referencePreviewImages)
  const shouldShowImageGrid = status === 'running' || images.length > 0

  return (
    <>
      <article className={cn('min-w-0 rounded-lg border border-border bg-fill p-3', className)}>
        <div className="mb-3 min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            <p className="line-clamp-2 min-w-0 flex-1 text-base font-medium text-text-strong">{prompt}</p>
            <TaskAction status={status} onCancel={onCancel} />
          </div>
          <p className="mt-2 text-base text-text-muted">任务时间 {formatCreatedAt(createdAt)}</p>
        </div>

        {message && status === 'running' ? <p className="mb-3 line-clamp-2 text-base text-text-muted">{message}</p> : null}
        {error ? (
          <p className={cn('line-clamp-2 text-base text-text-error', (shouldShowImageGrid || references.length > 0) && 'mb-3')}>
            {error}
          </p>
        ) : null}
        {references.length > 0 ? <ReferenceImageStrip references={references} onPreviewReference={referencePreview.openPreview} /> : null}

        {shouldShowImageGrid ? (
          <div className={getImageGridClassName(imageSlots.length)}>
            {imageSlots.map((image, slotIndex) => (
              <div
                className={getImageSlotClassName(imageSlots.length)}
                key={image?.index ?? `placeholder-${slotIndex}`}
              >
                {image ? (
                  <div className="group relative size-full overflow-hidden rounded-lg">
                    <button
                      aria-label={`预览图片 ${getImageDisplayIndex(image.index, images)}`}
                      className="block size-full cursor-pointer overflow-hidden rounded-lg"
                      type="button"
                      onClick={() => imagePreview.openPreview(image)}
                    >
                      <img
                        alt={`${prompt}，图片 ${getImageDisplayIndex(image.index, images)}`}
                        className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                        src={image.imageUrl}
                      />
                    </button>
                    {image.imagePath && onOpenImageLocation ? (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-end bg-gradient-to-t from-text-strong/55 to-text-strong/0 p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          aria-label={`打开图片 ${getImageDisplayIndex(image.index, images)} 所在文件夹`}
                          className="pointer-events-auto flex size-8 cursor-pointer items-center justify-center rounded-lg bg-background-solid/15 text-background-solid transition-colors hover:bg-background-solid/25"
                          title="打开所在文件夹"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void onOpenImageLocation(image)
                          }}
                        >
                          <FolderOpen className="size-4" strokeWidth={1.8} />
                        </button>
                      </div>
                    ) : null}
                  </div>
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

      {referencePreview.isOpen && referencePreview.previewImage ? (
        <ImagePreviewOverlay
          currentPosition={referencePreview.currentPosition}
          image={referencePreview.previewImage}
          imageCount={referencePreview.imageCount}
          prompt="参考图"
          onClose={referencePreview.closePreview}
          onNext={referencePreview.showNext}
          onPrevious={referencePreview.showPrevious}
          onResetZoom={referencePreview.resetZoom}
          onZoomByDelta={referencePreview.zoomByDelta}
          onZoomIn={referencePreview.zoomIn}
          onZoomOut={referencePreview.zoomOut}
          zoom={referencePreview.zoom}
        />
      ) : null}
    </>
  )
}

function ReferenceImageStrip({
  references,
  onPreviewReference,
}: {
  references: ImageReference[]
  onPreviewReference: (image: GeneratedImageResultImage) => void
}) {
  return (
    <div className="mb-3">
      <p className="mb-2 text-base text-text-muted">参考图 {references.length}</p>
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {references.map((reference, index) => (
          <button
            aria-label={`预览参考图 ${index + 1}${reference.name ? `，${reference.name}` : ''}`}
            className={cn(
              'group relative size-14 shrink-0 overflow-hidden rounded-lg bg-background-subtle',
              reference.imageUrl ? 'cursor-pointer' : 'cursor-default',
            )}
            disabled={!reference.imageUrl}
            key={reference.id || `${reference.path}-${index}`}
            title={reference.name ?? reference.path}
            type="button"
            onClick={() => {
              if (!reference.imageUrl) {
                return
              }

              onPreviewReference({
                index,
                imageUrl: reference.imageUrl,
                imagePath: reference.path,
              })
            }}
          >
            {reference.imageUrl ? (
              <img
                alt={`参考图 ${index + 1}${reference.name ? `，${reference.name}` : ''}`}
                className="size-full object-cover transition-transform group-hover:scale-[1.03]"
                src={reference.imageUrl}
              />
            ) : (
              <div className="flex size-full items-center justify-center text-text-muted">
                <ImagePlus className="size-5" strokeWidth={1.8} />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-text-strong/55 px-1 py-0.5 text-center text-base leading-tight text-background-solid opacity-0 transition-opacity group-hover:opacity-100">
              {index + 1}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function createReferencePreviewImages(references: ImageReference[]): GeneratedImageResultImage[] {
  return references.flatMap((reference, index) => {
    if (!reference.imageUrl) {
      return []
    }

    return [
      {
        index,
        imageUrl: reference.imageUrl,
        imagePath: reference.path,
      },
    ]
  })
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
        className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-fill-hover hover:text-text-error"
        title="取消生成任务"
        type="button"
        onClick={() => {
          void onCancel()
        }}
      >
        <CircleX className="size-5" fill="currentColor" stroke="var(--background-solid)" strokeWidth={1.8} />
      </button>
    )
  }

  return <StatusBadge status={status} />
}

function StatusBadge({ status }: { status: GeneratedImageResultStatus }) {
  return (
    <div
      aria-label={getStatusText(status)}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg"
      title={getStatusText(status)}
    >
      <StatusIcon status={status} />
    </div>
  )
}

function StatusIcon({ status }: { status: GeneratedImageResultStatus }) {
  if (status === 'complete') {
    return <CircleCheck className="size-5 text-text-success" fill="currentColor" stroke="var(--background-solid)" strokeWidth={1.8} />
  }

  if (status === 'error') {
    return <CircleAlert className="size-5 text-text-error" fill="currentColor" stroke="var(--background-solid)" strokeWidth={1.8} />
  }

  if (status === 'running') {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-accent text-background-solid">
        <Loader2 className="size-3.5 animate-spin" strokeWidth={2.2} />
      </span>
    )
  }

  return <CircleX className="size-5 text-text-muted" fill="currentColor" stroke="var(--background-solid)" strokeWidth={1.8} />
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
    return 'grid w-full max-w-full grid-cols-1 gap-2'
  }

  return 'grid w-full max-w-full grid-cols-2 gap-2'
}

function getImageSlotClassName(slotCount: number) {
  if (slotCount === 1) {
    return 'aspect-[4/3] w-full overflow-hidden rounded-lg bg-background-subtle'
  }

  return 'aspect-square w-full overflow-hidden rounded-lg bg-background-subtle'
}

function formatCreatedAt(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}
