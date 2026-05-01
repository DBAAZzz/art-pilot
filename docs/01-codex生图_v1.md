# Codex 生图 v1 方案

## 背景

当前主线程的 Codex 生图链路是一次性请求响应：

```txt
renderer
  -> window.api.generateImage()
  -> ipcRenderer.invoke(IPC_CHANNELS.image.generate)
main
  -> ipcMain.handle(IPC_CHANNELS.image.generate)
  -> ImageGenerationService
  -> CodexImageProvider.generate()
  -> codex exec --json
  -> 解析 image_generation_end.saved_path
renderer
  <- Promise<ImageGenerationResult>
```

这个模式语义上类似 HTTP RPC：发起请求，等待最终结果。它可以返回多张图片，因为 `ImageGenerationResult.imagePaths` 是数组，但无法表达“第 1 张完成，第 2 张仍在 loading”的中间状态。

从真实 Codex 会话记录验证后，Codex 的 JSONL 事件已经提供了更稳定的图片完成信号：每张图片生成完成时会出现 `image_generation_end` 事件，并携带 `saved_path`。因此 v1 不需要通过扫描 `~/.codex/generated_images` 发现图片，应该以 Codex JSONL 事件作为唯一实时来源。

v1 的目标是：

- 支持一次 Codex 生图任务生成多张图片。
- 保持多张图片在同一个 Codex 上下文中生成，支持连续图片、分镜、角色一致性。
- 支持 UI 逐张展示 loading / done / error 状态。
- 为图片尺寸、参考图等参数预留扩展空间。
- 区分 Art Pilot 自己的任务 ID 和 Codex 自己的会话 ID。

## 核心决策

一个用户生成请求对应一个 Art Pilot job。

一个 Art Pilot job 只启动一个 Codex `exec` 进程。

一个 Codex `exec` 进程对应一个 Codex thread。

多张图片是同一个 Codex thread 下的多个输出结果，不拆成多个独立 Codex 任务。

```txt
ImageGenerationJob
  jobId: Art Pilot 生成
  codexThreadId: Codex CLI 生成
  process: 单个 codex exec --json 子进程
  outputs: 多个 image-found 事件
```

不采用“按图片数量拆成 N 个 Codex 任务”的方案。原因是连续图片、分镜和角色一致性依赖同一上下文；拆任务会破坏能力边界，并且并发多个 Codex 命令也会增加资源消耗。

v1 不实现多 job 并发队列。当前产品按单主窗口、单 active image job 处理：同一时间只允许一个生图 job 运行。renderer 在 job running 时应禁用“生成”动作，或要求用户先取消当前 job 再发起新的 job。main process 也应防御性拒绝第二个未完成 job，避免重复点击绕过 UI 限制。

## IPC 模型

保留 request-response IPC 用于启动任务，但图片进度通过事件推送。

```txt
renderer
  -> image:generate-start
main
  <- { jobId }

main
  -> image:generation-event started
  -> image:generation-event codex-thread-started
  -> image:generation-event image-found
  -> image:generation-event image-found
  -> image:generation-event complete
renderer
  -> 根据 jobId 更新对应 UI
```

Electron 没有必须使用 SSE 的要求。这里用 `webContents.send(...)` 和 `ipcRenderer.on(...)` 实现等价的事件流。

建议新增 IPC channel：

```ts
export const IPC_CHANNELS = {
  image: {
    generateStart: 'image:generate-start',
    generationEvent: 'image:generation-event',
    cancel: 'image:cancel',
  },
} as const
```

`generateStart` 只负责启动任务并返回 `jobId`：

```ts
type ImageGenerationStartResult = {
  jobId: string
}
```

`generationEvent` 负责推送任务生命周期和图片产出。

`image-found` 应由 Codex JSONL 中的 `image_generation_end.saved_path` 触发，而不是由目录扫描触发。

### 事件订阅时序

renderer 必须先注册 `onImageGenerationEvent`，再调用 `startImageGeneration`。否则 main process 可能在 `startImageGeneration` 返回后、renderer 注册监听前就已经发出 `started` 或 `codex-thread-started`，导致首批事件丢失。

推荐 renderer 调用顺序：

```ts
const unsubscribe = window.api.onImageGenerationEvent(handleEvent)
const { jobId } = await window.api.startImageGeneration(request)
```

v1 不新增 `image:generate-ready` IPC。main process 可以在 job 内保留最近事件作为 debug，但不承诺为迟到订阅者重放事件。React 组件卸载时必须调用 `unsubscribe()`。

## 请求参数

v1 请求参数需要从单一 prompt 扩展为可演进结构：

```ts
export type ImageGenerationSize =
  | 'auto'
  | '1024x1024'
  | '1536x1024'
  | '1024x1536'

export type ImageReference = {
  id: string
  kind: 'local-file'
  path: string
  name?: string
  mimeType?: string
}

export type ImageGenerationRequest = {
  prompt: string
  count?: number
  size?: ImageGenerationSize
  references?: ImageReference[]
}
```

### 图片数量

`count` 表示期望生成的图片数量。主线程不把它拆成多个 Codex 进程，而是在同一个 prompt 中明确要求 Codex/ImageGen 生成指定数量的独立图片。

示例 prompt 编排：

```txt
请使用 ImageGen skill 根据以下提示生成图片。
必须生成 3 张图片。
这 3 张图片属于同一个连续上下文，请保持角色、风格、世界观一致。
如果图片文件被保存，请在最终回答回复 ok。

用户提示：
...
```

### 图片尺寸

`size` 表示期望输出尺寸。它应该进入 prompt，而不是由 renderer 自己解释。

示例：

```txt
图片尺寸：1024x1536
```

如果 Codex/ImageGen 当前环境不支持精确尺寸，provider 仍应保留该字段，并在 prompt 中传达用户意图。

### 参考图

v1 优先使用本地文件路径，而不是 Base64。

原因：

- 这是 Electron 本地应用，main process 可以安全读取本地文件。
- Codex CLI 天然支持 `--image <FILE>` 参数。
- Base64 会显著增大 IPC payload，不利于多参考图、日志和调试。
- 本地路径更适合长任务、重试和后续审计。

推荐第一版只支持：

```ts
type ImageReference = {
  id: string
  kind: 'local-file'
  path: string
  name?: string
  mimeType?: string
}
```

后续如果需要支持剪贴板、远程图片或内存 blob，再扩展：

```ts
type ImageReference =
  | { id: string; kind: 'local-file'; path: string; name?: string; mimeType?: string }
  | { id: string; kind: 'base64'; data: string; mimeType: string; name?: string }
```

## 事件模型

建议事件类型：

```ts
export type ImageGenerationEvent =
  | {
      type: 'started'
      jobId: string
      count: number
      size?: ImageGenerationSize
    }
  | {
      type: 'codex-thread-started'
      jobId: string
      codexThreadId: string
    }
  | {
      type: 'image-found'
      jobId: string
      codexThreadId?: string
      index: number
      imagePath: string
      imageUrl: string
      callId?: string
    }
  | {
      type: 'message'
      jobId: string
      codexThreadId?: string
      text: string
      metadata?: {
        revisedPrompt?: string
        callId?: string
      }
    }
  | {
      type: 'complete'
      jobId: string
      codexThreadId?: string
      imagePaths: string[]
      sessionPaths: string[]
    }
  | {
      type: 'error'
      jobId: string
      codexThreadId?: string
      error: string
      reason?: 'timeout' | 'process-crashed' | 'api-error' | 'cancelled'
    }
```

`jobId` 是 Art Pilot 自己生成的任务 ID，启动任务前即可得到。

`codexThreadId` 是 Codex CLI 自己生成的 thread ID，需要等 `codex exec --json` 输出 `thread.started` 后才能得到。

实际 Codex JSONL 事件示例：

```json
{"type":"thread.started","thread_id":"019ddf11-e554-7321-b505-8e8778854d6f"}
```

因此 `codexThreadId` 在事件上应是可选字段，或者通过单独的 `codex-thread-started` 事件通知 renderer。

## Codex JSONL 事件

当前 `runCodexExec()` 会收集 stdout，并在进程结束后一次性 resolve。v1 应新增 streaming 版本：

```ts
runCodexExecStreaming(executablePath, request, callbacks)
```

职责：

- 启动 `codex exec --json`。
- 将 prompt 写入 stdin。
- 按行解析 stdout 中的 JSONL 事件。
- 捕获 `thread.started` 并发出 `codex-thread-started`。
- 捕获 `image_generation_end.saved_path` 并立即发出 `image-found`。
- 进程结束后发出 `complete`。
- 出错时发出 `error`。

真实会话中已经验证到的关键事件：

```json
{
  "type": "event_msg",
  "payload": {
    "type": "image_generation_end",
    "call_id": "ig_...",
    "saved_path": "/Users/mac/.codex/generated_images/<codexThreadId>/ig_....png",
    "revised_prompt": "..."
  }
}
```

处理规则：

1. 遇到 `payload.type === "image_generation_end"`。
2. 提取 `payload.saved_path`，作为最终图片路径。
3. 提取 `payload.call_id`，用于调试和关联 revised prompt。
4. 按收到 `image_generation_end` 的顺序分配 `index`。
5. 立即发送 `image-found`。
6. 将 `saved_path` 追加到当前 job 的 `imagePaths`。
7. 遇到 `payload.type === "task_complete"` 或子进程正常退出后，发送 `complete`。

`image_generation_call` 可作为辅助事件处理，但不是图片完成信号。它可能包含 `revised_prompt`，也可能包含巨大的 `result` 字段，不应作为图片展示来源。

## 本地图片访问协议

`image_generation_end.saved_path` 是 main process 内部使用的真实文件路径，不应直接作为 renderer 的 `<img src>`。

Electron 默认开启 `webSecurity`，renderer 直接加载 `file:///Users/...` 容易触发 `Not allowed to load local resource`、CSP 或跨源限制。v1 应注册受控自定义协议，由 main process 映射图片 URL 到真实路径。

推荐事件中同时返回：

```ts
{
  type: 'image-found',
  jobId: '...',
  index: 0,
  imagePath: '/Users/mac/.codex/generated_images/.../ig_....png',
  imageUrl: 'artpilot-image://generated/<jobId>/0'
}
```

renderer 只使用 `imageUrl` 渲染图片。`imagePath` 保留给调试、历史记录和后续文件操作，不直接进入 `<img src>`。

协议注册要求：

- 在 app ready 前调用 `protocol.registerSchemesAsPrivileged(...)`，声明 `artpilot-image` 为 secure / standard 协议。
- 在 app ready 后调用 `protocol.handle('artpilot-image', handler)`。
- handler 不从 URL 反解任意磁盘路径，而是查 main process 内存中的 `jobId/index -> saved_path` 映射。
- handler 必须校验路径在允许目录内，例如 `~/.codex/generated_images` 或 Art Pilot 自己的缓存目录。
- 禁止支持类似 `artpilot-image://generated//etc/passwd` 这种把任意路径塞进 URL 的形式。
- `imageRegistry` 是纯内存映射，应用重启即清空。v1 不支持历史记录中的旧 `imageUrl` 跨重启继续可用。

示意：

```ts
protocol.handle('artpilot-image', (request) => {
  const { jobId, index } = parseGeneratedImageUrl(request.url)
  const imagePath = imageRegistry.get(jobId, index)

  assertAllowedGeneratedImagePath(imagePath)

  return net.fetch(pathToFileURL(imagePath).toString())
})
```

历史记录不在 v1 范围内。后续如果要做历史记录，应把图片导入 Art Pilot 自己的资产目录，并为持久化资产设计稳定 URL；不要复用 `artpilot-image://generated/<jobId>/<index>` 这种临时 job URL。

## 内存安全

Codex 的图片事件可能携带完整 Base64 图片数据，字段名通常是 `result`。真实会话中，`image_generation_end` 和 `image_generation_call` 都可能包含 `result`。单张图片对应的 JSONL 行可能达到数 MB 甚至更大。

主进程不得把 `result` 通过 IPC 发给 renderer，也不应写入应用日志。

初版可以在可接受内存范围内使用 `JSON.parse`，但实现上要把 `result` 当作高风险字段处理。更稳的实现是先做轻量提取：

```ts
type CodexImageEventFields = {
  payloadType?: string
  callId?: string
  savedPath?: string
  revisedPrompt?: string
}
```

解析器只需要识别：

- 外层 `type`
- `payload.type`
- `payload.call_id`
- `payload.saved_path`
- `payload.revised_prompt`
- `payload.message`
- `payload.thread_id` 或 `thread_id`

不要读取、复制、转发 `payload.result`。

stdout 是流式 chunk，不保证一个 chunk 就是一行完整 JSONL。实现必须维护 line buffer：

1. 每次收到 stdout chunk，追加到 buffer。
2. 按 `\n` 切分完整行。
3. 保留最后一个未完成片段到下一次 chunk。
4. 对完整行做轻量字段提取。
5. 无法识别或无法解析的行应忽略并记录 debug，不应中断整个 job。

## 图片归属和顺序

图片归属以当前 Codex 子进程对应的 `jobId` 为准。因为每个 Art Pilot job 只启动一个 Codex `exec --json` 子进程，所以从该子进程 stdout 收到的 `image_generation_end` 都属于当前 job。

`saved_path` 中的目录通常包含 Codex thread/session id，例如：

```txt
~/.codex/generated_images/019ddf05-1610-7ec3-a0f0-bc1afcaa6942/ig_....png
```

这个目录可用于后续清理和审计，但不再用于发现图片。

图片顺序以 `image_generation_end` 到达顺序为准，不依赖文件名、不依赖 `mtime`。

## 进程管理和退出清理

`ImageGenerationService` 必须维护当前 active job：

```ts
type ActiveImageGenerationJob = {
  jobId: string
  codexThreadId?: string
  childProcess: ChildProcess
  imagePaths: string[]
  stderrTail: string
  status: 'running' | 'cancelling'
  ownerWebContentsId: number
}
```

应用退出或所属 `webContents` 销毁时必须清理未完成的 Codex 子进程，避免后台继续消耗资源或 API 额度。

推荐清理策略：

1. `before-quit`、窗口关闭、页面 reload 或 owner `webContents.destroyed` 时触发清理。
2. 先对仍在运行的子进程发送 `SIGTERM`。
3. 等待 2-5 秒。
4. 仍未退出时发送 `SIGKILL`。

如果后续发现 Codex CLI 会再启动子进程，需要升级为进程组清理，避免只杀掉父进程。

React Router 的路由切换不等于 `webContents` 销毁。路由切换只会导致组件卸载，v1 不因此自动取消 job；页面组件应调用 `onImageGenerationEvent` 返回的 unsubscribe，避免重复监听。job 是否继续展示由当前页面状态决定，v1 不实现路由切换后的任务恢复。

事件只发送给发起 job 的 owner `webContents`。`ImageGenerationService` 应保存 `ownerWebContentsId`，发送事件时通过该 id 找回对应 `webContents`，不要用 `BrowserWindow.getAllWindows()` 广播。DevTools、about 窗口或未来其它窗口不应收到该 job 的图片事件。

取消任务也应复用同一套清理逻辑。用户主动取消时，最终事件可以使用：

```ts
{
  type: 'error',
  jobId,
  error: 'Image generation cancelled',
  reason: 'cancelled'
}
```

取消存在竞态：用户点击取消时，Codex 子进程可能已经生成最后一张图，并在退出前继续输出 stdout。v1 规则是：job 一旦进入 `cancelling` 状态，后续 stdout JSONL 事件全部丢弃，不再发送新的 `image-found`、`message` 或 `complete`。最终只发送一次取消结果，避免 UI 同时收到“新图片完成”和“任务已取消”的不确定顺序。

## stderr 和超时

streaming helper 必须同时监听 stdout、stderr 和进程退出事件。

启动失败需要和运行超时区分：

- `findCodexExecutable()` 找不到可执行文件时，不创建 job，直接返回或发送 `error`，`reason` 可用 `process-crashed`，错误文案为“未找到 codex 命令”。
- `spawn()` 自身触发 `error` 事件，通常表示路径错误、权限不足或进程无法启动，应立即发送启动失败 error。
- 子进程在第一个有效 JSONL 事件前以非 0 code 退出，通常是认证失败、网络错误、配置错误或 CLI 自身错误；应使用 stderr tail 作为错误详情。
- `startupTimeoutMs` 只表示进程已启动但长时间没有任何有效 JSONL 事件，不应和上述启动失败混为一类。

stderr 处理规则：

- stderr 不等于失败；Codex 可能会把 warning 打到 stderr。
- 主进程应维护 stderr ring buffer，只保留最后 N KB，例如 16 KB。
- 当子进程 `exitCode !== 0` 或启动失败时，用 stderr tail 生成 `error` 事件。
- 不把完整 stderr 无限累积到内存，也不把大段日志直接透传给 renderer。

进程失败时的事件建议：

```ts
{
  type: 'error',
  jobId,
  codexThreadId,
  error: stderrTail || `codex exec exited with code ${code}`,
  reason: 'process-crashed'
}
```

超时应至少包含两类：

- `startupTimeoutMs`：启动后长时间没有任何 JSONL 事件，说明 Codex 可能没有正常进入任务。
- `inactivityTimeoutMs`：任务开始后长时间没有 stdout/stderr 活动，说明进程可能卡死。

可选再加 `absoluteTimeoutMs`，限制单个 job 最大总时长。

每次收到 stdout 或 stderr data 都应刷新 inactivity timer。超时后主进程主动终止子进程，并发送：

```ts
{
  type: 'error',
  jobId,
  codexThreadId,
  error: 'Image generation timed out',
  reason: 'timeout'
}
```

## Preload API

建议 preload 暴露小而明确的 API：

```ts
export interface ElectronApi {
  startImageGeneration: (request: ImageGenerationRequest) => Promise<ImageGenerationStartResult>
  onImageGenerationEvent: (callback: (event: ImageGenerationEvent) => void) => () => void
  cancelImageGeneration: (jobId: string) => Promise<void>
}
```

`onImageGenerationEvent` 应返回 unsubscribe 函数，避免页面切换后重复监听。

preload 安全基线：

- `BrowserWindow.webPreferences.contextIsolation` 必须保持开启。
- `nodeIntegration` 必须保持关闭。
- renderer 不直接访问 Node.js、Electron 或文件系统 API。
- 所有能力通过 `contextBridge.exposeInMainWorld(...)` 暴露，不直接把对象挂到 `window`。
- preload 暴露的 API 保持最小面，入参在 main process 再做校验。

## UI 状态

renderer 收到 `startImageGeneration` 的 `jobId` 后，根据 `count` 创建固定数量的 slot：

```ts
type ImageSlot = {
  index: number
  status: 'loading' | 'done' | 'error'
  imagePath?: string
  error?: string
}
```

v1 同一时间只允许一个 active job。job running 时 UI 应禁用再次生成，或把再次生成设计成“先取消当前 job，再启动新 job”的显式动作。

收到 `image-found` 后，将对应 slot 更新为 `done`。

renderer 应使用 `imageUrl` 作为 `<img src>`，不要使用真实 `imagePath`。

收到 `complete` 后，如果实际图片少于 `count`，剩余 slot 应展示失败或未生成状态。

收到 `error` 后，当前 job 未完成的 slot 应进入 error 状态。

## 取消任务

v1 可以预留取消能力：

```txt
renderer -> image:cancel(jobId)
main -> 找到 job 对应 child process
main -> child.kill('SIGTERM')
main -> 推送 error 或 cancelled 事件
```

如果需要区分取消和错误，可以后续增加：

```ts
| { type: 'cancelled'; jobId: string; codexThreadId?: string }
```

## stdin 和参考图参数

将 prompt 写给 Codex 子进程时，必须关闭 stdin：

```ts
child.stdin.end(prompt)
```

不要只调用 `child.stdin.write(prompt)` 后保持 stdin 打开，否则 Codex CLI 可能一直等待输入结束。

参考图传参必须使用 `spawn(executablePath, args)` 的参数数组，不走 shell 拼接：

```ts
args.push('--image', reference.path)
```

这样可以正确处理空格、中文和特殊字符路径。不要构造 `codex --image "${path}"` 字符串交给 shell 执行。

在传给 Codex 前，main process 应校验本地参考图：

- 文件存在且可读。
- 路径指向普通文件，不是目录。
- 扩展名或 MIME 类型属于允许的图片类型。
- 路径来自用户显式选择或应用允许的来源。

如果参考图校验失败，应在启动 Codex 前返回 `error`，不要让 job 进入长时间 loading。

## 迁移步骤

1. 在 `packages/shared/src/index.ts` 扩展 image IPC channels、请求类型、事件类型和 preload API 类型。
2. 在 `apps/desktop/electron/utils/codexCli.ts` 新增 streaming exec helper。
3. 在 `apps/desktop/electron/providers/codexImageProvider.ts` 增加 streaming generate 方法，以 `image_generation_end.saved_path` 作为图片完成信号。
4. 注册 `artpilot-image://` 自定义协议，并实现 `jobId/index -> saved_path` 的受控图片映射。
5. 在 `ImageGenerationService` 管理单 active job、子进程、取消、退出清理、owner webContents 销毁清理、stderr tail、timeout 和事件派发。
6. 在 `ImageGenerationController` 注册 `image:generate-start` 和 `image:cancel`。
7. 在 `preload.ts` 暴露 `startImageGeneration`、`onImageGenerationEvent`、`cancelImageGeneration`。
8. renderer 根据事件模型实现多 slot loading，并使用 `imageUrl` 渲染图片。
9. 保留最终 `complete` 中的 `imagePaths`、`codexThreadId` 和 `sessionPaths`，方便调试和历史记录。

## v1 非目标

- 不实现远程图片 URL 下载。
- 不实现 Base64 参考图传输。
- 不拆分多个 Codex 子进程来并行生成多张图。
- 不实现多 job 并发队列；v1 单主窗口只维护一个 active image job。
- 不实现 React 路由切换后的 job 状态恢复；路由切换只取消事件订阅，不自动取消主进程 job。
- 不通过目录扫描、`mtime`、`fs.watch` 发现图片；这些只能作为调试兜底，不进入 v1 主链路。
- 不通过 IPC 传输 Codex 事件中的 Base64 `result`。
- 不直接调用图片模型 API；当前仍通过 Codex CLI 编排 ImageGen。

## 最终结论

v1 应采用真实事件驱动方案：

```txt
codex exec --json
  -> payload.type === "image_generation_end"
  -> payload.saved_path
  -> image-found
```

这个方案比目录扫描更稳定，能准确解决多图归属、顺序和实时展示问题。`~/.codex/generated_images/<codexThreadId>` 仍有价值，但它的用途是清理、审计和调试，不是发现图片。
