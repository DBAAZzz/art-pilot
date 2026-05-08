import { Copy, ExternalLink, FolderOpen, Heart } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { AssetImage } from '@art-pilot/shared'
import type React from 'react'
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import type { AssetViewMode } from '@/stores/assetManagementStore'

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})
const dateGroupFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})
const dateGroupWithYearFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
  year: 'numeric',
})
const MIN_TILE_WIDTH = 156
const GRID_GAP = 12
const GROUP_HEADER_HEIGHT = 32
const GROUP_TOP_GAP = 28

type AssetGalleryProps = {
  assets: AssetImage[]
  onCopyPrompt: (asset: AssetImage) => void | Promise<void>
  onOpen: (asset: AssetImage) => void
  onOpenImageLocation: (asset: AssetImage) => void | Promise<void>
  onReuse: (asset: AssetImage) => void
  onToggleFavorite: (asset: AssetImage) => void | Promise<void>
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  viewMode: AssetViewMode
}

type GalleryRow =
  | {
      count: number
      height: number
      key: string
      label: string
      topGap: number
      type: 'group-header'
    }
  | {
      assets: AssetImage[]
      height: number
      key: string
      type: 'asset-row'
    }

export const AssetGallery = memo(function AssetGallery({
  assets,
  onCopyPrompt,
  onOpen,
  onOpenImageLocation,
  onReuse,
  onToggleFavorite,
  scrollContainerRef,
  viewMode,
}: AssetGalleryProps) {
  const assetGroups = useMemo(() => groupAssetsByDate(assets), [assets])
  const containerRef = useRef<HTMLDivElement | null>(null)
  const containerWidth = useElementWidth(containerRef)
  const layout = useMemo(() => createGalleryLayout({
    assetGroups,
    assets,
    containerWidth,
    viewMode,
  }), [assetGroups, assets, containerWidth, viewMode])
  const rowVirtualizer = useVirtualizer({
    count: layout.rows.length,
    estimateSize: (index) => layout.rows[index]?.height ?? layout.tileSize,
    getItemKey: (index) => layout.rows[index]?.key ?? index,
    getScrollElement: () => scrollContainerRef.current,
    overscan: 7,
  })

  useEffect(() => {
    rowVirtualizer.measure()
  }, [layout.rows, rowVirtualizer])

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = layout.rows[virtualRow.index]

        if (!row) {
          return null
        }

        return (
          <div
            className="absolute left-0 top-0 w-full"
            key={row.key}
            style={{
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {row.type === 'group-header' ? (
              <div className="flex items-center gap-3" style={{ paddingTop: row.topGap }}>
                <h2 className="text-base font-semibold text-text-strong">{row.label}</h2>
                <span className="text-base text-text-muted">{row.count} 张</span>
              </div>
            ) : (
              <AssetGrid
                assets={row.assets}
                columns={layout.columns}
                tileSize={layout.tileSize}
                onCopyPrompt={onCopyPrompt}
                onOpen={onOpen}
                onOpenImageLocation={onOpenImageLocation}
                onReuse={onReuse}
                onToggleFavorite={onToggleFavorite}
              />
            )}
          </div>
        )
      })}
    </div>
  )
})

const AssetGrid = memo(function AssetGrid({
  assets,
  onCopyPrompt,
  onOpen,
  onOpenImageLocation,
  onReuse,
  onToggleFavorite,
  columns,
  tileSize,
}: Omit<AssetGalleryProps, 'scrollContainerRef' | 'viewMode'> & {
  columns: number
  tileSize: number
}) {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {assets.map((asset) => (
        <AssetAlbumTile
          asset={asset}
          key={asset.imageId}
          size={tileSize}
          onCopyPrompt={onCopyPrompt}
          onOpenImageLocation={onOpenImageLocation}
          onOpen={onOpen}
          onReuse={onReuse}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  )
})

const AssetAlbumTile = memo(function AssetAlbumTile({
  asset,
  onCopyPrompt,
  onOpenImageLocation,
  onOpen,
  onReuse,
  onToggleFavorite,
  size,
}: {
  asset: AssetImage
  onCopyPrompt: (asset: AssetImage) => void | Promise<void>
  onOpenImageLocation: (asset: AssetImage) => void | Promise<void>
  onOpen: (asset: AssetImage) => void
  onReuse: (asset: AssetImage) => void
  onToggleFavorite: (asset: AssetImage) => void | Promise<void>
  size: number
}) {
  return (
    <article className="group relative overflow-hidden rounded-lg bg-background-subtle" style={{ height: size }}>
      <button className="block aspect-square w-full cursor-pointer overflow-hidden" type="button" onClick={() => onOpen(asset)}>
        <img alt={asset.prompt} className="size-full object-cover" decoding="async" draggable={false} loading="lazy" src={asset.thumbnailUrl} />
      </button>
      <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-black/5 transition-colors duration-100 group-hover:ring-black/10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/45 via-black/10 to-transparent p-2 opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100">
        <div className="min-w-0 text-white">
          <p className="truncate text-base font-medium leading-4">{asset.fileName}</p>
          <p className="text-base leading-4 text-white/75">{formatDate(asset.createdAt)} · {asset.aspectRatio ?? formatDimensions(asset)}</p>
        </div>
        <button
          aria-label="继续创作"
          className="pointer-events-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/18 text-white transition-colors hover:bg-white/28"
          title="基于此图继续创作"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onReuse(asset)
          }}
        >
          <ExternalLink className="size-4" strokeWidth={1.8} />
        </button>
      </div>
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-100 ease-out group-hover:opacity-100">
        <TileIconButton label="收藏" onClick={() => onToggleFavorite(asset)}>
          <Heart className={cn('size-4', asset.favorite && 'fill-current text-text-error')} strokeWidth={1.8} />
        </TileIconButton>
        <TileIconButton label="复制 prompt" onClick={() => onCopyPrompt(asset)}>
          <Copy className="size-4" strokeWidth={1.8} />
        </TileIconButton>
        <TileIconButton label="在 Finder 中显示" onClick={() => onOpenImageLocation(asset)}>
          <FolderOpen className="size-4" strokeWidth={1.8} />
        </TileIconButton>
      </div>
      {asset.favorite ? (
        <div className="pointer-events-none absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/35 text-white group-hover:hidden">
          <Heart className="size-3.5 fill-current text-text-error" strokeWidth={1.8} />
        </div>
      ) : null}
    </article>
  )
})

function TileIconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void | Promise<void> }) {
  return (
    <button
      aria-label={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/35 text-white transition-colors hover:bg-black/50"
      title={label}
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        void onClick()
      }}
    >
      {children}
    </button>
  )
}

function useElementWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current

    if (!element) {
      return
    }

    const updateWidth = () => {
      setWidth(Math.floor(element.getBoundingClientRect().width))
    }
    const resizeObserver = new ResizeObserver(updateWidth)

    updateWidth()
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [ref])

  return width
}

function createGalleryLayout({
  assetGroups,
  assets,
  containerWidth,
  viewMode,
}: {
  assetGroups: ReturnType<typeof groupAssetsByDate>
  assets: AssetImage[]
  containerWidth: number
  viewMode: AssetViewMode
}) {
  const width = Math.max(containerWidth, MIN_TILE_WIDTH)
  const columns = Math.max(1, Math.floor((width + GRID_GAP) / (MIN_TILE_WIDTH + GRID_GAP)))
  const tileSize = Math.floor((width - (columns - 1) * GRID_GAP) / columns)
  const rows: GalleryRow[] = []

  if (viewMode === 'flat') {
    appendAssetRows(rows, assets, columns, tileSize)

    return { columns, rows, tileSize }
  }

  assetGroups.forEach((group, index) => {
    rows.push({
      count: group.assets.length,
      height: GROUP_HEADER_HEIGHT + (index === 0 ? 0 : GROUP_TOP_GAP),
      key: `header:${group.key}`,
      label: group.label,
      topGap: index === 0 ? 0 : GROUP_TOP_GAP,
      type: 'group-header',
    })
    appendAssetRows(rows, group.assets, columns, tileSize, group.key)
  })

  return { columns, rows, tileSize }
}

function appendAssetRows(rows: GalleryRow[], assets: AssetImage[], columns: number, tileSize: number, groupKey = 'flat') {
  for (let index = 0; index < assets.length; index += columns) {
    const rowAssets = assets.slice(index, index + columns)

    rows.push({
      assets: rowAssets,
      height: tileSize + GRID_GAP,
      key: `assets:${groupKey}:${index}`,
      type: 'asset-row',
    })
  }
}

function groupAssetsByDate(assets: AssetImage[]) {
  const groups = new Map<string, AssetImage[]>()

  for (const asset of assets) {
    const key = getDateKey(asset.createdAt)
    const group = groups.get(key)

    if (group) {
      group.push(asset)
    } else {
      groups.set(key, [asset])
    }
  }

  return [...groups.entries()].map(([key, groupAssets]) => ({
    assets: groupAssets,
    key,
    label: formatDateGroupLabel(groupAssets[0]?.createdAt ?? Date.now()),
  }))
}

function getDateKey(timestamp: number) {
  const date = new Date(timestamp)

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDateGroupLabel(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (getDateKey(timestamp) === getDateKey(today.getTime())) {
    return '今天'
  }

  if (getDateKey(timestamp) === getDateKey(yesterday.getTime())) {
    return '昨天'
  }

  return (date.getFullYear() === today.getFullYear() ? dateGroupFormatter : dateGroupWithYearFormatter).format(date)
}

function formatDate(timestamp: number) {
  return dateTimeFormatter.format(timestamp)
}

function formatDimensions(asset: Pick<AssetImage, 'width' | 'height'>) {
  if (!asset.width || !asset.height) {
    return '未知尺寸'
  }

  return `${asset.width} x ${asset.height}`
}
