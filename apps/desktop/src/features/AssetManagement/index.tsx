import {
  Copy,
  ExternalLink,
  FolderOpen,
  Grid3X3,
  Heart,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  SlidersHorizontal,
  StretchHorizontal,
} from 'lucide-react'
import type { AssetImage, AssetStats } from '@art-pilot/shared'
import type React from 'react'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { cn } from '@/lib/utils'
import type { AssetViewMode } from '@/stores/assetManagementStore'
import { createAssetQueryKey, useAssetManagementStore } from '@/stores/assetManagementStore'

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

export { AssetDetailPage } from '../AssetDetailPage'

export function AssetManagementPage() {
  const navigate = useNavigate()
  const assets = useAssetManagementStore((state) => state.assets)
  const stats = useAssetManagementStore((state) => state.stats)
  const search = useAssetManagementStore((state) => state.search)
  const favoriteOnly = useAssetManagementStore((state) => state.favoriteOnly)
  const viewMode = useAssetManagementStore((state) => state.viewMode)
  const total = useAssetManagementStore((state) => state.total)
  const loading = useAssetManagementStore((state) => state.loading)
  const loadingMore = useAssetManagementStore((state) => state.loadingMore)
  const error = useAssetManagementStore((state) => state.error)
  const hasLoaded = useAssetManagementStore((state) => state.hasLoaded)
  const storedQueryKey = useAssetManagementStore((state) => state.queryKey)
  const loadAssets = useAssetManagementStore((state) => state.loadAssets)
  const loadStats = useAssetManagementStore((state) => state.loadStats)
  const refreshAssets = useAssetManagementStore((state) => state.refreshAssets)
  const setSearch = useAssetManagementStore((state) => state.setSearch)
  const setFavoriteOnly = useAssetManagementStore((state) => state.setFavoriteOnly)
  const setViewMode = useAssetManagementStore((state) => state.setViewMode)
  const toggleAssetFavorite = useAssetManagementStore((state) => state.toggleFavorite)
  const assetQueryKey = useMemo(() => createAssetQueryKey(favoriteOnly, search), [favoriteOnly, search])
  const hasMore = assets.length < total

  useEffect(() => {
    if (hasLoaded && storedQueryKey === assetQueryKey) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadAssets('replace')
    }, 160)

    return () => window.clearTimeout(timeoutId)
  }, [assetQueryKey, hasLoaded, loadAssets, storedQueryKey])

  useEffect(() => {
    void loadStats()
  }, [assets.length, loadStats])

  const toggleFavorite = useCallback(async (asset: AssetImage) => {
    await toggleAssetFavorite(asset)
  }, [toggleAssetFavorite])

  const openImageLocation = useCallback(async (asset: AssetImage) => {
    await window.api.openImageFileLocation(asset.imagePath)
  }, [])

  const copyPrompt = useCallback(async (asset: AssetImage) => {
    await navigator.clipboard.writeText(asset.prompt)
  }, [])

  const openAsset = useCallback((asset: AssetImage) => {
    navigate(`/assets/${encodeURIComponent(asset.imageId)}`)
  }, [navigate])

  const reuseAsset = useCallback((asset: AssetImage) => {
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
  }, [navigate])

  return (
    <section className="col-span-2 flex min-h-0 flex-col overflow-hidden rounded-lg bg-background-solid">
      <header className="shrink-0 border-b border-border bg-background-solid/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <p className="shrink-0 text-base text-text-muted">{formatStats(stats, total)}</p>
          <div className="ml-2 flex h-8 shrink-0 rounded-lg bg-background-subtle p-0.5">
            <button
              className={cn(
                'h-7 cursor-pointer rounded-md px-3 text-base font-medium transition-colors',
                !favoriteOnly ? 'bg-background-solid text-text-strong shadow-sm' : 'text-text-muted hover:text-text-strong',
              )}
              type="button"
              onClick={() => setFavoriteOnly(false)}
            >
              全部
            </button>
            <button
              className={cn(
                'h-7 cursor-pointer rounded-md px-3 text-base font-medium transition-colors',
                favoriteOnly ? 'bg-background-solid text-text-strong shadow-sm' : 'text-text-muted hover:text-text-strong',
              )}
              type="button"
              onClick={() => setFavoriteOnly(true)}
            >
              已收藏
            </button>
          </div>
          <div className="flex h-8 shrink-0 rounded-lg bg-background-subtle p-0.5">
            <ViewModeButton
              icon={<StretchHorizontal className="size-4" strokeWidth={1.8} />}
              isActive={viewMode === 'date'}
              label="按日期"
              onClick={() => setViewMode('date')}
            />
            <ViewModeButton
              icon={<Grid3X3 className="size-4" strokeWidth={1.8} />}
              isActive={viewMode === 'flat'}
              label="平铺"
              onClick={() => setViewMode('flat')}
            />
          </div>
          <div className="relative ml-auto w-[min(420px,42vw)] min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.8} />
            <Input
              className="w-full border-transparent bg-background-subtle pl-9"
              placeholder="搜索 prompt、文件名或任务 ID"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-background-subtle px-2 text-base text-text-muted">
            <SlidersHorizontal className="size-4" strokeWidth={1.8} />
            {assets.length}/{total}
          </div>
          <button
            aria-label="重新加载资产"
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-background-subtle hover:text-text-strong"
            type="button"
            onClick={() => void refreshAssets()}
          >
            <RefreshCw className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="art-pilot-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {error ? (
          <StateMessage title="资产加载失败" description={error} />
        ) : loading ? (
          <StateMessage icon={<Loader2 className="size-5 animate-spin" strokeWidth={1.8} />} title="正在加载资产" />
        ) : assets.length === 0 ? (
          <StateMessage title="暂无图片资产" description="完成一次生成后，图片会出现在这里。" />
        ) : (
          <>
            <AssetGallery
              assets={assets}
              viewMode={viewMode}
              onCopyPrompt={copyPrompt}
              onOpen={openAsset}
              onOpenImageLocation={openImageLocation}
              onReuse={reuseAsset}
              onToggleFavorite={toggleFavorite}
            />

            {hasMore ? (
              <div className="mt-5 flex justify-center">
                <Button disabled={loadingMore} variant="ghost" onClick={() => void loadAssets('append', assets.length)}>
                  {loadingMore ? '加载中...' : '加载更多'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}

const AssetAlbumTile = memo(function AssetAlbumTile({
  asset,
  onCopyPrompt,
  onOpenImageLocation,
  onOpen,
  onReuse,
  onToggleFavorite,
}: {
  asset: AssetImage
  onCopyPrompt: (asset: AssetImage) => void | Promise<void>
  onOpenImageLocation: (asset: AssetImage) => void | Promise<void>
  onOpen: (asset: AssetImage) => void
  onReuse: (asset: AssetImage) => void
  onToggleFavorite: (asset: AssetImage) => void | Promise<void>
}) {
  return (
    <article className="group relative overflow-hidden rounded-lg bg-background-subtle transition-transform duration-100 ease-out hover:-translate-y-0.5 hover:will-change-transform">
      <button className="block aspect-square w-full cursor-pointer overflow-hidden" type="button" onClick={() => onOpen(asset)}>
        <img alt={asset.prompt} className="size-full object-cover transition-transform duration-150 ease-out group-hover:scale-[1.025] group-hover:will-change-transform" decoding="async" loading="lazy" src={asset.thumbnailUrl} />
      </button>
      <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-black/5 transition-colors duration-100 group-hover:ring-black/10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-1 items-end justify-between gap-2 bg-gradient-to-t from-black/45 via-black/10 to-transparent p-2 opacity-0 transition-[opacity,transform] duration-100 ease-out group-hover:translate-y-0 group-hover:opacity-100">
        <div className="min-w-0 text-white">
          <p className="truncate text-base font-medium leading-4">{asset.fileName}</p>
          <p className="text-base leading-4 text-white/75">{formatDate(asset.createdAt)} · {asset.aspectRatio ?? formatDimensions(asset)}</p>
        </div>
        <button
          aria-label="继续创作"
          className="pointer-events-auto flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/18 text-white backdrop-blur transition-colors hover:bg-white/28"
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
      <div className="absolute right-2 top-2 flex translate-y-[-2px] gap-1 opacity-0 transition-[opacity,transform] duration-100 ease-out group-hover:translate-y-0 group-hover:opacity-100">
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
        <div className="pointer-events-none absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur group-hover:hidden">
          <Heart className="size-3.5 fill-current text-text-error" strokeWidth={1.8} />
        </div>
      ) : null}
    </article>
  )
})

const AssetGallery = memo(function AssetGallery({
  assets,
  onCopyPrompt,
  onOpen,
  onOpenImageLocation,
  onReuse,
  onToggleFavorite,
  viewMode,
}: {
  assets: AssetImage[]
  onCopyPrompt: (asset: AssetImage) => void | Promise<void>
  onOpen: (asset: AssetImage) => void
  onOpenImageLocation: (asset: AssetImage) => void | Promise<void>
  onReuse: (asset: AssetImage) => void
  onToggleFavorite: (asset: AssetImage) => void | Promise<void>
  viewMode: AssetViewMode
}) {
  const assetGroups = useMemo(() => groupAssetsByDate(assets), [assets])

  if (viewMode === 'flat') {
    return (
      <AssetGrid
        assets={assets}
        onCopyPrompt={onCopyPrompt}
        onOpen={onOpen}
        onOpenImageLocation={onOpenImageLocation}
        onReuse={onReuse}
        onToggleFavorite={onToggleFavorite}
      />
    )
  }

  return (
    <div className="space-y-7">
      {assetGroups.map((group) => (
        <section key={group.key}>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-base font-semibold text-text-strong">{group.label}</h2>
            <span className="text-base text-text-muted">{group.assets.length} 张</span>
          </div>
          <AssetGrid
            assets={group.assets}
            onCopyPrompt={onCopyPrompt}
            onOpen={onOpen}
            onOpenImageLocation={onOpenImageLocation}
            onReuse={onReuse}
            onToggleFavorite={onToggleFavorite}
          />
        </section>
      ))}
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
}: {
  assets: AssetImage[]
  onCopyPrompt: (asset: AssetImage) => void | Promise<void>
  onOpen: (asset: AssetImage) => void
  onOpenImageLocation: (asset: AssetImage) => void | Promise<void>
  onReuse: (asset: AssetImage) => void
  onToggleFavorite: (asset: AssetImage) => void | Promise<void>
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(156px,1fr))] gap-3 [grid-auto-flow:dense]">
      {assets.map((asset) => (
        <AssetAlbumTile
          asset={asset}
          key={asset.imageId}
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

function ViewModeButton({
  icon,
  isActive,
  label,
  onClick,
}: {
  icon: React.ReactNode
  isActive: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        'flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-base font-medium transition-colors',
        isActive ? 'bg-background-solid text-text-strong shadow-sm' : 'text-text-muted hover:text-text-strong',
      )}
      title={label}
      type="button"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function TileIconButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void | Promise<void> }) {
  return (
    <button
      aria-label={label}
      className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/50"
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

function formatStats(stats: AssetStats | null, total: number) {
  if (!stats) {
    return `${total} 张图片`
  }

  return `共 ${stats.imageCount} 张图片 · 占用 ${formatBytes(stats.totalBytes)}`
}

function formatDate(timestamp: number) {
  return dateTimeFormatter.format(timestamp)
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
