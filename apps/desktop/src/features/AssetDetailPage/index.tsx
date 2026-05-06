import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FolderOpen,
  Heart,
  ImageIcon,
  Loader2,
} from 'lucide-react'
import type { AssetImage, AssetImageDetail } from '@art-pilot/shared'
import type React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { Button } from '@/components/Button'
import { ImagePreviewOverlay } from '@/components/ImagePreviewOverlay'
import type { ImagePreviewItem } from '@/hooks/useImagePreview'
import { useImagePreview } from '@/hooks/useImagePreview'
import { cn } from '@/lib/utils'

const REFERENCE_PREVIEW_INDEX_OFFSET = 10_000

export function AssetDetailPage() {
  const navigate = useNavigate()
  const { imageId } = useParams()
  const [asset, setAsset] = useState<AssetImageDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const currentSiblingIndex = useMemo(() => {
    if (!asset) {
      return -1
    }

    return asset.siblingImages.findIndex((sibling) => sibling.imageId === asset.imageId)
  }, [asset])
  const safeSiblingIndex = currentSiblingIndex >= 0 ? currentSiblingIndex : 0
  const previousSibling = asset && asset.siblingImages.length > 1
    ? asset.siblingImages[(safeSiblingIndex - 1 + asset.siblingImages.length) % asset.siblingImages.length]
    : null
  const nextSibling = asset && asset.siblingImages.length > 1
    ? asset.siblingImages[(safeSiblingIndex + 1) % asset.siblingImages.length]
    : null

  const previewItems = useMemo<ImagePreviewItem[]>(
    () => {
      if (!asset) {
        return []
      }

      return [
        {
          index: 0,
          imagePath: asset.imagePath,
          imageUrl: asset.imageUrl,
        },
        ...asset.references.flatMap((reference, index) => reference.imageUrl
          ? [{
              index: REFERENCE_PREVIEW_INDEX_OFFSET + index,
              imagePath: reference.path,
              imageUrl: reference.imageUrl,
            }]
          : []),
      ]
    },
    [asset],
  )
  const imagePreview = useImagePreview(previewItems)

  const navigateToSibling = useCallback((sibling: { imageId: string } | null) => {
    if (!sibling) {
      return
    }

    navigate(`/assets/${encodeURIComponent(sibling.imageId)}`)
  }, [navigate])

  useEffect(() => {
    if (!imageId) {
      setError('图片 ID 不存在')
      setLoading(false)
      return
    }

    let isCurrent = true

    setLoading(true)
    setError(null)

    void window.api.getAssetDetail(decodeURIComponent(imageId)).then((detail) => {
      if (!isCurrent) {
        return
      }

      setAsset(detail)
      setError(detail ? null : '没有找到这张图片')
    }).catch((detailError) => {
      if (isCurrent) {
        setError(detailError instanceof Error ? detailError.message : String(detailError))
      }
    }).finally(() => {
      if (isCurrent) {
        setLoading(false)
      }
    })

    return () => {
      isCurrent = false
    }
  }, [imageId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (imagePreview.isOpen || isEditableTarget(event.target)) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        navigateToSibling(previousSibling)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        navigateToSibling(nextSibling)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [imagePreview.isOpen, navigateToSibling, nextSibling, previousSibling])

  async function toggleFavorite() {
    if (!asset) {
      return
    }

    const nextFavorite = !asset.favorite
    await window.api.setAssetFavorite(asset.imageId, nextFavorite)
    setAsset({ ...asset, favorite: nextFavorite })
  }

  async function openImageLocation() {
    if (asset) {
      await window.api.openImageFileLocation(asset.imagePath)
    }
  }

  async function copyPrompt() {
    if (asset) {
      await navigator.clipboard.writeText(asset.prompt)
    }
  }

  function reuseAsset() {
    if (!asset) {
      return
    }

    navigate('/', {
      state: {
        assetReuse: {
          prompt: asset.prompt,
          reference: {
            id: asset.imageId,
            kind: 'local-file',
            path: asset.imagePath,
            name: asset.fileName,
            mimeType: 'image/png',
            imageUrl: asset.imageUrl,
          },
        },
      },
    })
  }

  if (loading) {
    return (
      <section className="h-full min-h-0 rounded-lg bg-background-solid">
        <StateMessage icon={<Loader2 className="size-5 animate-spin" strokeWidth={1.8} />} title="正在加载图片详情" />
      </section>
    )
  }

  if (error || !asset) {
    return (
      <section className="h-full min-h-0 rounded-lg bg-background-solid">
        <StateMessage title="图片详情加载失败" description={error ?? '未知错误'} />
      </section>
    )
  }

  const mainPreviewItem = previewItems[0]

  return (
    <section className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_380px] overflow-hidden rounded-lg bg-background-solid">
      <div className="min-h-0 bg-background-solid">
        <header className="flex h-14 items-center justify-between border-b border-border bg-background-solid/88 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button className="gap-1.5" variant="ghost" onClick={() => navigate('/assets')}>
              <ArrowLeft className="size-4" strokeWidth={1.8} />
              返回
            </Button>
            <div className="flex items-center rounded-lg bg-background-subtle p-0.5">
              <NavButton label="上一张" disabled={!previousSibling} onClick={() => navigateToSibling(previousSibling)}>
                <ChevronLeft className="size-4" strokeWidth={1.9} />
              </NavButton>
              <NavButton label="下一张" disabled={!nextSibling} onClick={() => navigateToSibling(nextSibling)}>
                <ChevronRight className="size-4" strokeWidth={1.9} />
              </NavButton>
            </div>
            {asset.siblingImages.length > 1 ? (
              <span className="text-base text-text-muted">
                {safeSiblingIndex + 1}/{asset.siblingImages.length}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button aria-label="在 Finder 中显示" title="在 Finder 中显示" variant="ghost" onClick={openImageLocation}>
              <FolderOpen className="size-4" strokeWidth={1.8} />
            </Button>
            <Button aria-label={asset.favorite ? '取消收藏' : '收藏'} variant="ghost" onClick={toggleFavorite}>
              <Heart className={cn('size-4', asset.favorite && 'fill-current text-text-error')} strokeWidth={1.8} />
            </Button>
            <Button
              className="gap-1.5 bg-text-strong text-white hover:bg-text-strong/90"
              onClick={reuseAsset}
            >
              <ExternalLink className="size-4" strokeWidth={1.8} />
              继续创作
            </Button>
          </div>
        </header>

        <div className="group relative flex h-[calc(100%-56px)] items-center justify-center overflow-hidden px-8 py-10">
          <div className="relative flex min-h-0 w-full items-center justify-center">
            <SiblingHoverButton
              direction="left"
              disabled={!previousSibling}
              label="上一张"
              onClick={() => navigateToSibling(previousSibling)}
            />
            <button
              className="block max-h-full max-w-full cursor-zoom-in overflow-hidden rounded-lg shadow-[0_18px_70px_rgba(0,0,0,0.16)]"
              type="button"
              onClick={() => mainPreviewItem && imagePreview.openPreview(mainPreviewItem)}
            >
              <img
                alt={asset.prompt}
                className="max-h-[calc(100vh-160px)] max-w-full object-contain"
                src={asset.imageUrl}
              />
            </button>
            <SiblingHoverButton
              direction="right"
              disabled={!nextSibling}
              label="下一张"
              onClick={() => navigateToSibling(nextSibling)}
            />
          </div>

        </div>
      </div>

      <aside className="art-pilot-scrollbar min-h-0 overflow-y-auto border-l border-border bg-background-solid p-4">
        <div className="mb-4">
          <h1 className="truncate text-xl font-semibold text-text-strong" title={asset.fileName}>{asset.fileName}</h1>
          <p className="mt-1 text-base text-text-muted">{formatFullDate(asset.createdAt)}</p>
        </div>

        <DetailSection
          action={(
            <button
              aria-label="复制 Prompt"
              className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-fill-hover hover:text-text-strong"
              title="复制 Prompt"
              type="button"
              onClick={() => void copyPrompt()}
            >
              <Copy className="size-3.5" strokeWidth={1.8} />
            </button>
          )}
          title="Prompt"
        >
          <p className="max-h-56 overflow-y-auto whitespace-pre-wrap pr-1 text-base leading-6 text-text-strong">{asset.prompt}</p>
        </DetailSection>

        {asset.references.length > 0 ? (
          <DetailSection title="参考图">
            <ReferenceStrip
              references={asset.references}
              onOpenReference={(index) => {
                const referencePreview = previewItems.find((item) => item.index === REFERENCE_PREVIEW_INDEX_OFFSET + index)
                if (referencePreview) {
                  imagePreview.openPreview(referencePreview)
                }
              }}
            />
          </DetailSection>
        ) : null}

        <DetailSection title="图片信息">
          <div className="space-y-2">
            <DetailRow label="尺寸" value={formatDimensions(asset)} />
            <OptionalDetailRow label="比例" value={asset.aspectRatio} />
            <OptionalDetailRow label="大小" value={asset.fileSize ? formatBytes(asset.fileSize) : undefined} />
            {asset.status !== 'complete' ? <StatusRow status={asset.status} /> : null}
          </div>
        </DetailSection>

        <details className="mt-4 rounded-lg bg-background-subtle p-3">
          <summary className="cursor-pointer text-base font-semibold text-text-strong">高级参数</summary>
          <div className="mt-3 space-y-2">
            <OptionalDetailRow label="provider" value={asset.generationParams?.provider ?? 'codex'} />
            <OptionalDetailRow label="model" value={asset.generationParams?.model} />
            <OptionalDetailRow label="checkpoint" value={asset.generationParams?.checkpoint} />
            <OptionalDetailRow label="基础生成尺寸" value={asset.generationParams?.size ?? asset.size} />
            <OptionalDetailRow label="aspectRatio" value={asset.generationParams?.aspectRatio ?? asset.aspectRatio} />
            <OptionalDetailRow label="seed" value={asset.generationParams?.seed} />
            <OptionalDetailRow label="steps" value={asset.generationParams?.steps} />
            <OptionalDetailRow label="sampler" value={asset.generationParams?.sampler} />
            <OptionalDetailRow label="cfgScale" value={asset.generationParams?.cfgScale} />
            <OptionalDetailRow label="count" value={asset.generationParams?.count} />
            <CopyableDetailRow label="jobId" value={asset.jobId} />
            <CopyableDetailRow label="codexThreadId" value={asset.codexThreadId} />
            <OptionalDetailRow label="cleanup" value={asset.cleanupStatus === 'none' ? undefined : asset.cleanupStatus} />
          </div>
        </details>
      </aside>

      {imagePreview.isOpen && imagePreview.previewImage ? (
        <ImagePreviewOverlay
          currentPosition={imagePreview.currentPosition}
          image={imagePreview.previewImage}
          imageCount={imagePreview.imageCount}
          prompt={asset.prompt}
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
    </section>
  )
}

function NavButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-muted transition-colors hover:bg-background-solid hover:text-text-strong disabled:cursor-not-allowed disabled:opacity-35"
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function SiblingHoverButton({
  direction,
  disabled,
  label,
  onClick,
}: {
  direction: 'left' | 'right'
  disabled: boolean
  label: string
  onClick: () => void
}) {
  if (disabled) {
    return null
  }

  return (
    <button
      aria-label={label}
      className={cn(
        'absolute top-1/2 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white/82 text-text-strong opacity-0 shadow-sm backdrop-blur transition-[opacity,transform,background-color] duration-100 ease-out hover:bg-white group-hover:opacity-100',
        direction === 'left' ? 'left-5 hover:-translate-x-0.5' : 'right-5 hover:translate-x-0.5',
      )}
      title={label}
      type="button"
      onClick={onClick}
    >
      {direction === 'left' ? <ChevronLeft className="size-5" strokeWidth={2} /> : <ChevronRight className="size-5" strokeWidth={2} />}
    </button>
  )
}

function ReferenceStrip({
  onOpenReference,
  references,
}: {
  onOpenReference: (index: number) => void
  references: AssetImageDetail['references']
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {references.map((reference, index) => (
        <button
          aria-label={`查看参考图 ${index + 1}`}
          className="group/reference relative aspect-square overflow-hidden rounded-md bg-fill-hover ring-1 ring-black/5 transition-transform duration-100 ease-out hover:-translate-y-0.5 disabled:cursor-default disabled:hover:translate-y-0"
          disabled={!reference.imageUrl}
          key={reference.id || `${reference.path}-${index}`}
          title={reference.name ?? reference.path}
          type="button"
          onClick={() => onOpenReference(index)}
        >
          {reference.imageUrl ? (
            <img alt={reference.name ?? `参考图 ${index + 1}`} className="size-full object-cover" src={reference.imageUrl} />
          ) : (
            <span className="flex size-full items-center justify-center text-[11px] text-text-muted">无预览</span>
          )}
        </button>
      ))}
    </div>
  )
}

function DetailSection({
  action,
  children,
  title,
}: {
  action?: React.ReactNode
  children: React.ReactNode
  title: string
}) {
  return (
    <section className="mt-4 rounded-lg bg-background-subtle p-3">
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-text-strong">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-base">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-text-strong" title={typeof value === 'string' ? value : undefined}>{value}</span>
    </div>
  )
}

function OptionalDetailRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return <DetailRow label={label} value={String(value)} />
}

function CopyableDetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) {
    return null
  }

  return (
    <div className="group/id flex min-w-0 items-center justify-between gap-3 text-base">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="min-w-0 truncate text-right text-text-strong" title={value}>{value}</span>
        <button
          aria-label={`复制 ${label}`}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted opacity-0 transition-[opacity,color,background-color] duration-100 hover:bg-fill-hover hover:text-text-strong group-hover/id:opacity-100"
          title={`复制 ${label}`}
          type="button"
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          <Copy className="size-3.5" strokeWidth={1.8} />
        </button>
      </span>
    </div>
  )
}

function StatusRow({ status }: { status: AssetImage['status'] }) {
  const isError = status === 'error'

  return (
    <DetailRow
      label="状态"
      value={(
        <span className={cn(
          'rounded-md px-1.5 py-0.5 text-[12px] font-semibold',
          isError ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700',
        )}
        >
          {formatStatus(status)}
        </span>
      )}
    />
  )
}

function StateMessage({ description, icon, title }: { description?: string; icon?: React.ReactNode; title: string }) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center rounded-lg bg-background-subtle px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-fill-hover text-text-muted">
          {icon ?? <ImageIcon className="size-5" strokeWidth={1.8} />}
        </div>
        <h2 className="text-base font-semibold text-text-strong">{title}</h2>
        {description ? <p className="mt-1 text-base text-text-muted">{description}</p> : null}
      </div>
    </div>
  )
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function formatStatus(status: AssetImage['status']) {
  const statusText: Record<AssetImage['status'], string> = {
    cancelled: '已取消',
    complete: '已完成',
    error: '失败',
    running: '生成中',
  }

  return statusText[status] ?? status
}

function formatFullDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
  }).format(timestamp)
}

function formatBytes(bytes: number) {
  if (bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / (1024 ** unitIndex)

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDimensions(asset: Pick<AssetImage, 'width' | 'height'>) {
  if (!asset.width || !asset.height) {
    return '未知尺寸'
  }

  return `${asset.width} x ${asset.height}`
}
