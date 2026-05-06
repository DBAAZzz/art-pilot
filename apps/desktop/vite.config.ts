import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'node:path'

export default defineConfig(async () => {
  const { default: tailwindcss } = await import('@tailwindcss/vite')

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      tailwindcss(),
      react(),
      electron([
        {
          entry: 'electron/main.ts',
          vite: {
            build: {
              rollupOptions: {
                external: ['better-sqlite3'],
              },
            },
          },
          onstart(args) {
            const env = { ...process.env }
            delete env.ELECTRON_RUN_AS_NODE

            args.startup(['.', '--no-sandbox'], { env })
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(args) {
            args.reload()
          },
        },
      ]),
      renderer(),
    ],
  }
})
