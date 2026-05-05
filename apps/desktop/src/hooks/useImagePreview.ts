import { useCallback, useEffect, useMemo, useState } from 'react'

export type ImagePreviewItem = {
  index: number
  imageUrl: string
  imagePath?: string
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 4
const ZOOM_STEP = 0.25

export function useImagePreview<TImage extends ImagePreviewItem>(images: TImage[]) {
  const sortedImages = useMemo(
    () => [...images].sort((left, right) => left.index - right.index),
    [images],
  )
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)

  const previewImagePosition = sortedImages.findIndex((image) => image.index === previewImageIndex)
  const previewImage = previewImagePosition >= 0 ? sortedImages[previewImagePosition] : null

  const closePreview = useCallback(() => {
    setPreviewImageIndex(null)
    setZoom(1)
  }, [])

  const openPreview = useCallback((image: TImage) => {
    setPreviewImageIndex(image.index)
    setZoom(1)
  }, [])

  const resetZoom = useCallback(() => {
    setZoom(1)
  }, [])

  const zoomIn = useCallback(() => {
    setZoom((currentZoom) => clampZoom(currentZoom + ZOOM_STEP))
  }, [])

  const zoomOut = useCallback(() => {
    setZoom((currentZoom) => clampZoom(currentZoom - ZOOM_STEP))
  }, [])

  const zoomByDelta = useCallback((delta: number) => {
    setZoom((currentZoom) => clampZoom(currentZoom + delta))
  }, [])

  const showPrevious = useCallback(() => {
    setPreviewImageIndex((currentIndex) => {
      if (sortedImages.length === 0) {
        return null
      }

      const currentPosition = sortedImages.findIndex((image) => image.index === currentIndex)
      const previousPosition = currentPosition <= 0 ? sortedImages.length - 1 : currentPosition - 1

      return sortedImages[previousPosition]?.index ?? null
    })
  }, [sortedImages])

  const showNext = useCallback(() => {
    setPreviewImageIndex((currentIndex) => {
      if (sortedImages.length === 0) {
        return null
      }

      const currentPosition = sortedImages.findIndex((image) => image.index === currentIndex)
      const nextPosition = currentPosition < 0 || currentPosition >= sortedImages.length - 1 ? 0 : currentPosition + 1

      return sortedImages[nextPosition]?.index ?? null
    })
  }, [sortedImages])

  useEffect(() => {
    if (previewImageIndex !== null && !sortedImages.some((image) => image.index === previewImageIndex)) {
      closePreview()
    }
  }, [closePreview, previewImageIndex, sortedImages])

  useEffect(() => {
    setZoom(1)
  }, [previewImageIndex])

  useEffect(() => {
    if (!previewImage) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePreview()
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showPrevious()
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        showNext()
        return
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        zoomIn()
        return
      }

      if (event.key === '-') {
        event.preventDefault()
        zoomOut()
        return
      }

      if (event.key === '0') {
        event.preventDefault()
        resetZoom()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closePreview, previewImage, resetZoom, showNext, showPrevious, zoomIn, zoomOut])

  return {
    closePreview,
    currentPosition: previewImagePosition >= 0 ? previewImagePosition + 1 : 0,
    imageCount: sortedImages.length,
    isOpen: Boolean(previewImage),
    openPreview,
    previewImage,
    resetZoom,
    showNext,
    showPrevious,
    zoom,
    zoomByDelta,
    zoomIn,
    zoomOut,
  }
}

function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(zoom.toFixed(2))))
}
