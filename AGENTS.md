# Art Pilot Architecture

## Repository Layout

This repository uses `pnpm workspace` and a monorepo layout.

```txt
art-pilot/
├── apps/
│   └── desktop/              # Electron desktop app
├── packages/
│   └── shared/               # Shared constants and TypeScript types
├── package.json              # Root workspace scripts
├── pnpm-workspace.yaml       # Workspace package globs
└── pnpm-lock.yaml
```

Root commands:

```bash
pnpm dev
pnpm typecheck
pnpm build
```

The root `package.json` should mainly orchestrate workspace packages. App-specific dependencies belong in the app package that uses them.

## Workspace Packages

### `apps/desktop`

Electron desktop application.

```txt
apps/desktop/
├── src/                      # Renderer process: React UI
├── electron/                 # Main process and preload code
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### `packages/shared`

Shared code used by both the Electron side and the renderer side.

Current responsibilities:

```txt
packages/shared/src/index.ts
├── IPC_CHANNELS              # Typed IPC channel names
├── VersionsApi               # window.versions type
└── ElectronApi               # window.api type
```

Use this package for cross-boundary constants and types. Do not put Electron-only or DOM-only runtime logic here.

## Desktop App Architecture

```txt
apps/desktop/electron/
├── main.ts                   # Main process entry
├── preload.ts                # Safe bridge exposed to renderer
├── core/                     # App lifecycle and window management
│   ├── appLifecycle.ts
│   └── windowManager.ts
├── controllers/              # IPC entry points
│   ├── baseController.ts
│   ├── fileController.ts
│   └── index.ts
├── services/                 # Business logic
│   └── fileService.ts
└── api/                      # Compatibility or thin API wrappers
    └── read.ts
```

## Process Boundaries

Electron has three important layers:

```txt
Renderer process
  -> preload bridge
  -> main process
```

Renderer code lives in:

```txt
apps/desktop/src/
```

Main process code lives in:

```txt
apps/desktop/electron/
```

Shared types and constants live in:

```txt
packages/shared/
```

The renderer must not directly access Node.js APIs. Expose controlled APIs through `preload.ts`.

## IPC Flow

Current file-reading flow:

```txt
apps/desktop/src/App.tsx
  -> window.api.readTxtFile()
  -> apps/desktop/electron/preload.ts
  -> IPC_CHANNELS.file.readOneTextFile
  -> FileController
  -> FileService
  -> 1.txt
```

When adding a new main-process capability:

1. Add or reuse a channel in `packages/shared/src/index.ts`.
2. Add a method to `ElectronApi` if the renderer needs to call it.
3. Expose the method in `apps/desktop/electron/preload.ts`.
4. Add a controller under `apps/desktop/electron/controllers/`.
5. Put business logic in `apps/desktop/electron/services/`.
6. Register the controller in `apps/desktop/electron/controllers/index.ts`.
7. Update `apps/desktop/src/types/global.d.ts` only if the shared API type changes are not enough.

## Directory Responsibilities

### `core`

Application-level lifecycle and long-lived managers.

Examples:

```txt
WindowManager
AppLifecycle
TrayManager
MenuManager
ShortcutManager
```

### `controllers`

IPC-facing entry points. Controllers translate renderer calls into service calls.

Controllers should:

- Register `ipcMain.handle(...)`
- Validate or normalize incoming parameters when needed
- Delegate real work to services

Controllers should not contain large business logic.

### `services`

Business logic and Node.js integration.

Examples:

```txt
FileService
SettingsService
SearchService
SystemService
```

Services can use Node.js APIs such as `fs`, `path`, and local databases.

### `preload.ts`

The only place that exposes main-process capabilities to the renderer.

Use `contextBridge.exposeInMainWorld(...)`.

Keep the exposed surface small and explicit.

### `packages/shared`

Cross-process and cross-package types/constants.

Good candidates:

```txt
IPC channel constants
window.api TypeScript interfaces
shared request/response types
domain model types
```

Bad candidates:

```txt
Electron runtime logic
Node.js file operations
React components
DOM utilities
```

## Path Rules

In the Electron main process, remember that source files are bundled to:

```txt
apps/desktop/dist-electron/
```

Runtime paths should be calculated from the bundled location, not from the source directory.

Current preload path:

```ts
path.join(__dirname, 'preload.js')
```

Current production renderer path:

```ts
path.join(process.env.DIST!, 'index.html')
```

## Development Rules

- Keep `apps/desktop/electron/main.ts` small.
- Do not put feature logic directly in `main.ts`.
- Do not expose arbitrary Node.js APIs to the renderer.
- Prefer typed IPC channel constants from `@art-pilot/shared`.
- Keep renderer UI code in `apps/desktop/src`.
- Keep main-process Node.js logic in `apps/desktop/electron/services`.
- Run `pnpm typecheck` after structural changes.
- Use `pnpm --filter @art-pilot/desktop exec vite build` to verify the desktop app build without running `electron-builder`.

