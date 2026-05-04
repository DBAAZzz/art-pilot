import { ChevronLeft, ChevronRight, Minus, RotateCcw, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export type ImagePreviewOverlayImage = {
  imageUrl: string
}

export function ImagePreviewOverlay({
  currentPosition,
  image,
  imageCount,
  onClose,
  onNext,
  onPrevious,
  onResetZoom,
  onZoomByDelta,
  onZoomIn,
  onZoomOut,
  prompt,
  zoom,
}: {
  currentPosition: number
  image: ImagePreviewOverlayImage
  imageCount: number
  onClose: () => void
  onNext: () => void
  onPrevious: () => void
  onResetZoom: () => void
  onZoomByDelta: (delta: number) => void
  onZoomIn: () => void
  onZoomOut: () => void
  prompt: string
  zoom: number
}) {
  const canNavigate = imageCount > 1
  const imageRef = useRef<HTMLImageElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ pointerId: number, x: number, y: number, offsetX: number, offsetY: number } | null>(null)

  useEffect(() => {
    setOffset({ x: 0, y: 0 })
    setDragStart(null)
  }, [image.imageUrl])

  useEffect(() => {
    if (zoom <= 1) {
      setOffset({ x: 0, y: 0 })
      setDragStart(null)
      return
    }

    setOffset((currentOffset) => clampOffset(currentOffset, zoom, imageRef.current, viewportRef.current))
  }, [zoom])

  function resetZoom() {
    setOffset({ x: 0, y: 0 })
    onResetZoom()
  }

  return (
    <div
      aria-label="图片预览"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-text-strong/85"
      role="dialog"
      onClick={onClose}
      onWheel={(event) => {
        event.preventDefault()
        onZoomByDelta(event.deltaY < 0 ? 0.1 : -0.1)
      }}
    >
      <div
        className="absolute inset-x-5 top-12 z-10 flex items-center justify-between"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <div className="rounded-full bg-background-solid/10 px-3 py-1 text-base text-background-solid">
          {currentPosition} / {imageCount}
        </div>
        <button
          aria-label="关闭预览"
          className="flex size-9 cursor-pointer items-center justify-center rounded-full bg-background-solid/10 text-background-solid transition-colors hover:bg-background-solid/20"
          type="button"
          onClick={onClose}
        >
          <X className="size-4" strokeWidth={1.8} />
        </button>
      </div>

      {canNavigate ? (
        <>
          <button
            aria-label="上一张图片"
            className="absolute left-5 top-1/2 z-10 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-background-solid/80 transition-colors hover:text-background-solid"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onPrevious()
            }}
          >
            <ChevronLeft className="size-11" strokeWidth={1.4} />
          </button>
          <button
            aria-label="下一张图片"
            className="absolute right-5 top-1/2 z-10 flex size-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-background-solid/80 transition-colors hover:text-background-solid"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onNext()
            }}
          >
            <ChevronRight className="size-11" strokeWidth={1.4} />
          </button>
        </>
      ) : null}

      <div
        ref={viewportRef}
        className="absolute inset-x-10 inset-y-8 flex items-center justify-center overflow-hidden"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <img
          ref={imageRef}
          alt={`${prompt}，图片 ${currentPosition}`}
          className="max-h-[96vh] max-w-[96vw] select-none rounded-lg object-contain"
          draggable={false}
          src={image.imageUrl}
          style={{
            cursor: zoom > 1 ? (dragStart ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none',
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
            transition: dragStart ? 'none' : 'transform 120ms ease-out',
          }}
          onDoubleClick={resetZoom}
          onPointerDown={(event) => {
            if (zoom <= 1) {
              return
            }

            event.currentTarget.setPointerCapture(event.pointerId)
            setDragStart({
              offsetX: offset.x,
              offsetY: offset.y,
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
            })
          }}
          onPointerMove={(event) => {
            if (!dragStart || dragStart.pointerId !== event.pointerId) {
              return
            }

            setOffset(clampOffset({
              x: dragStart.offsetX + event.clientX - dragStart.x,
              y: dragStart.offsetY + event.clientY - dragStart.y,
            }, zoom, imageRef.current, viewportRef.current))
          }}
          onPointerUp={(event) => {
            if (dragStart?.pointerId === event.pointerId) {
              setDragStart(null)
            }
          }}
          onPointerCancel={(event) => {
            if (dragStart?.pointerId === event.pointerId) {
              setDragStart(null)
            }
          }}
        />
      </div>

      <div
        className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full bg-background-solid/10 p-1 text-background-solid"
        onClick={(event) => {
          event.stopPropagation()
        }}
      >
        <button
          aria-label="缩小图片"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-background-solid/10"
          type="button"
          onClick={onZoomOut}
        >
          <Minus className="size-4" strokeWidth={1.8} />
        </button>
        <button
          aria-label="重置缩放"
          className="flex h-8 cursor-pointer items-center gap-1 rounded-full px-2 text-base transition-colors hover:bg-background-solid/10"
          type="button"
          onClick={resetZoom}
        >
          <RotateCcw className="size-3.5" strokeWidth={1.8} />
          {Math.round(zoom * 100)}%
        </button>
        <button
          aria-label="放大图片"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-background-solid/10"
          type="button"
          onClick={onZoomIn}
        >
          <Plus className="size-4" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}

function clampOffset(
  offset: { x: number, y: number },
  zoom: number,
  imageElement: HTMLImageElement | null,
  viewportElement: HTMLDivElement | null,
) {
  if (!imageElement || !viewportElement || zoom <= 1) {
    return { x: 0, y: 0 }
  }

  const maxX = Math.max(0, (imageElement.offsetWidth * zoom - viewportElement.clientWidth) / 2)
  const maxY = Math.max(0, (imageElement.offsetHeight * zoom - viewportElement.clientHeight) / 2)

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
