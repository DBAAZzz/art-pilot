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
  },
  window: {
    toggleMaximize: 'window:toggle-maximize',
  },
} as const
