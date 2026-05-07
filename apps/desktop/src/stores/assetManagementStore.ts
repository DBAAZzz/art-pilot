import type { AssetImage, AssetListResult, AssetStats } from '@art-pilot/shared'
import { create } from 'zustand'

export const ASSET_PAGE_SIZE = 60
export type AssetViewMode = 'date' | 'flat'

type LoadAssetsMode = 'replace' | 'append'

type AssetManagementStore = {
  assets: AssetImage[]
  error: string | null
  favoriteOnly: boolean
  hasLoaded: boolean
  loading: boolean
  loadingMore: boolean
  queryKey: string
  search: string
  stats: AssetStats | null
  total: number
  viewMode: AssetViewMode
  loadAssets: (mode?: LoadAssetsMode, appendOffset?: number) => Promise<void>
  loadStats: (force?: boolean) => Promise<void>
  refreshAssets: () => Promise<void>
  setFavoriteOnly: (favoriteOnly: boolean) => void
  setSearch: (search: string) => void
  setViewMode: (viewMode: AssetViewMode) => void
  toggleFavorite: (asset: AssetImage) => Promise<void>
}

let loadRequestId = 0

export const useAssetManagementStore = create<AssetManagementStore>((set, get) => ({
  assets: [],
  error: null,
  favoriteOnly: false,
  hasLoaded: false,
  loading: false,
  loadingMore: false,
  queryKey: createAssetQueryKey(false, ''),
  search: '',
  stats: null,
  total: 0,
  viewMode: 'date',
  loadAssets: async (mode = 'replace', appendOffset = 0) => {
    const isAppend = mode === 'append'
    const requestId = loadRequestId + 1
    loadRequestId = requestId

    set({
      error: null,
      loading: isAppend ? get().loading : true,
      loadingMore: isAppend,
    })

    try {
      const { favoriteOnly, search } = get()
      const result = await window.api.listAssets({
        favoriteOnly,
        limit: ASSET_PAGE_SIZE,
        offset: isAppend ? appendOffset : 0,
        search,
      })

      if (requestId !== loadRequestId) {
        return
      }

      set((state) => ({
        assets: isAppend ? mergeAssetPage(state.assets, result) : result.items,
        hasLoaded: true,
        queryKey: createAssetQueryKey(favoriteOnly, search),
        total: result.total,
      }))
    } catch (loadError) {
      if (requestId !== loadRequestId) {
        return
      }

      set({ error: loadError instanceof Error ? loadError.message : String(loadError) })
    } finally {
      if (requestId === loadRequestId) {
        set({ loading: false, loadingMore: false })
      }
    }
  },
  loadStats: async (force = false) => {
    if (get().stats && !force) {
      return
    }

    try {
      set({ stats: await window.api.getAssetStats() })
    } catch {
      set({ stats: null })
    }
  },
  refreshAssets: async () => {
    await Promise.all([
      get().loadAssets('replace'),
      get().loadStats(true),
    ])
  },
  setFavoriteOnly: (favoriteOnly) => {
    set({ favoriteOnly })
  },
  setSearch: (search) => {
    set({ search })
  },
  setViewMode: (viewMode) => {
    set({ viewMode })
  },
  toggleFavorite: async (asset) => {
    const nextFavorite = !asset.favorite
    await window.api.setAssetFavorite(asset.imageId, nextFavorite)
    set((state) => ({
      assets: state.assets.map((currentAsset) =>
        currentAsset.imageId === asset.imageId
          ? { ...currentAsset, favorite: nextFavorite }
          : currentAsset,
      ),
    }))
  },
}))

export function createAssetQueryKey(favoriteOnly: boolean, search: string) {
  return JSON.stringify({
    favoriteOnly,
    search: search.trim(),
  })
}

function mergeAssetPage(currentAssets: AssetImage[], result: AssetListResult) {
  const assetById = new Map(currentAssets.map((asset) => [asset.imageId, asset]))

  for (const asset of result.items) {
    assetById.set(asset.imageId, asset)
  }

  return [...assetById.values()]
}
