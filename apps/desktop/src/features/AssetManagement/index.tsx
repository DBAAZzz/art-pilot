import { Grid3X3, ImageIcon, Loader2, RefreshCw, Search, StretchHorizontal } from 'lucide-react'
import type { AssetImage } from '@art-pilot/shared'
import type React from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { cn } from '@/lib/utils'
import { createAssetQueryKey, useAssetManagementStore } from '@/stores/assetManagementStore'
import { AssetGallery } from './components/AssetGallery'

export { AssetDetailPage } from '../AssetDetailPage'

export function AssetManagementPage() {
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const assets = useAssetManagementStore((state) => state.assets)
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
  }, [loadStats])

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
    <section className="col-span-2 flex min-h-0 flex-col overflow-hidden bg-background-solid">
      <header className="shrink-0 bg-background-solid/95 px-5 pb-4 pt-5 backdrop-blur">
        <div className="flex items-center gap-3">
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
          <div className="flex h-8 shrink-0 rounded-lg bg-background-subtle p-0.5">
            <button
              className={cn(
                'h-7 rounded-md px-3 text-base font-medium transition-colors',
                !favoriteOnly ? 'bg-background-solid text-text-strong' : 'text-text-muted hover:text-text-strong',
              )}
              type="button"
              onClick={() => setFavoriteOnly(false)}
            >
              全部
            </button>
            <button
              className={cn(
                'h-7 rounded-md px-3 text-base font-medium transition-colors',
                favoriteOnly ? 'bg-background-solid text-text-strong' : 'text-text-muted hover:text-text-strong',
              )}
              type="button"
              onClick={() => setFavoriteOnly(true)}
            >
              已收藏
            </button>
          </div>
          <div className="min-w-0 flex-1" />
          <div className="relative w-[min(320px,32vw)] min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" strokeWidth={1.8} />
            <Input
              className="w-full border-transparent bg-background-subtle pl-9"
              placeholder="搜索资产"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            aria-label="重新加载资产"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-background-subtle hover:text-text-strong"
            type="button"
            onClick={() => void refreshAssets()}
          >
            <RefreshCw className="size-4" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div ref={scrollContainerRef} className="art-pilot-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5">
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
              scrollContainerRef={scrollContainerRef}
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
        'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-base font-medium transition-colors',
        isActive ? 'bg-background-solid text-text-strong' : 'text-text-muted hover:text-text-strong',
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
