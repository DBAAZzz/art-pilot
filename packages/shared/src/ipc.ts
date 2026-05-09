export const IPC_CHANNELS = {
  file: {
    readOneTextFile: 'file:read-one-text-file',
  },
  codex: {
    detectEnvironment: 'codex:detect-environment',
    readUsage: 'codex:read-usage',
  },
  image: {
    // 启动任务只返回 Art Pilot 自己的 jobId，后续进度全部走 generationEvent 推送。
    generateStart: 'image:generate-start',
    generationEvent: 'image:generation-event',
    cancel: 'image:cancel',
    selectReferences: 'image:select-references',
    pasteReferences: 'image:paste-references',
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
    selectImageLibraryFolder: 'settings:select-image-library-folder',
  },
  imageHistory: {
    listRecent: 'image-history:list-recent',
    openLibraryFolder: 'image-history:open-library-folder',
    openImageFileLocation: 'image-history:open-image-file-location',
  },
  assets: {
    list: 'assets:list',
    getDetail: 'assets:get-detail',
    getStats: 'assets:get-stats',
    setFavorite: 'assets:set-favorite',
  },
  system: {
    openExternalUrl: 'system:open-external-url',
  },
  prompt: {
    fillFromUrl: 'prompt:fill-from-url',
    saveTemplate: 'prompt:save-template',
    updateTemplate: 'prompt:update-template',
    listTemplates: 'prompt:list-templates',
    getTemplate: 'prompt:get-template',
    resolveTemplate: 'prompt:resolve-template',
    addAssetPreviewImage: 'prompt:add-asset-preview-image',
    previewImport: 'prompt:preview-import',
    save: 'prompt:save',
    list: 'prompt:list',
  },
  window: {
    toggleMaximize: 'window:toggle-maximize',
  },
} as const
