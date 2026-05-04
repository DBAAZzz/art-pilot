# Codex 生图 v4 参考图方案

## 背景

当前生图表单里已经有“添加参考图”的图标按钮，但它只是 UI 占位，没有实际选择图片、管理参考图或提交参考图的能力。

代码层面并不是完全没有准备。shared 和 main process 已经预留了参考图链路：

- `packages/shared/src/imageGeneration.ts` 已定义 `ImageReference`。
- `ImageGenerationRequest` 已有 `references?: ImageReference[]`。
- `CodexImageProvider.generateStreaming()` 已经把 `request.references` 映射成 Codex CLI 的 `--image <path>`。
- `ImageGenerationService.normalizeRequest()` 已经校验参考图路径、可读性和图片扩展名。

所以 v4 的重点不是重做生图后端，而是补齐 renderer 侧的选图、状态管理和提交链路。

## 目标

- 用户可以在桌面端选择本地图片作为参考图。
- 参考图随当前提示词一起提交给 Codex 生图任务。
- renderer 不直接访问 Node.js 文件系统能力，仍通过 preload 暴露的受控 API 与 main process 通信。
- 参考图选择结果在输入框区域有明确展示，用户能移除已选择的参考图。
- 生成任务提交成功后清空提示词和参考图；提交失败时保留提示词和参考图，方便用户修正后重试。
- 继续复用现有 `ImageGenerationRequest.references`、main process 校验和 Codex CLI `--image` 传参能力。
- 对参考图数量和文件大小设定明确上限，避免过多参考图或超大文件拖慢 Codex 进程。

## 非目标

- 不实现真正的云端上传。参考图只是本地文件引用，由 Codex CLI 读取。
- 不在第一版实现参考图缩略图预览。
- 不保存参考图到图片库或历史任务数据库。
- 不实现拖拽上传。
- 不实现参考图重新排序、标注权重或单图用途设置。
- 不改变现有生成结果图片的导入、历史记录和预览链路。

## 产品命名

这个能力建议在产品和代码里都称为“参考图”，不要叫“上传图片”。

原因：

- 当前图片不会上传到 Art Pilot 服务端。
- 技术实现是选择本地文件路径并传给 Codex CLI。
- “参考图”更准确表达它在生图任务中的语义：给模型提供视觉上下文，而不是作为待处理文件上传。

## 推荐方案

第一版做“本地参考图选择 + 文件名 chip 展示”。

交互流程：

1. 用户点击输入框右下角的图片按钮。
2. main process 打开系统文件选择器。
3. 用户选择一张或多张图片。再次点击“添加参考图”时是追加选择，不替换已有参考图。
4. renderer 在输入框底部展示已选择的参考图文件名。
5. 用户可以点击每个 chip 上的移除按钮删除单张参考图。
6. 点击生成时，把 `prompt`、`count`、`size` 和 `references` 一起提交。
7. 提交成功后清空 `prompt` 和 `references`。

MVP 展示形态：

```txt
参考图 2
[ image-a.png  x ] [ image-b.webp  x ]
```

第一版不显示缩略图。这样可以先验证 Codex `--image` 参考图链路是否稳定，避免把本地文件展示、协议注册和安全边界一起扩大。

没有参考图时不渲染 chip 区域。参考图是可选能力，大部分生成任务不需要占用额外输入空间。

## 限制策略

第一版建议设置：

```ts
const MAX_IMAGE_REFERENCES = 5
const MAX_IMAGE_REFERENCE_FILE_SIZE = 50 * 1024 * 1024
```

数量上限需要在两个位置体现：

- renderer 合并参考图时最多保留 5 张，避免 UI 和请求状态无限增长。
- main process 的 `ImageGenerationService.normalizeRequest()` 再次校验 `references.length`，不能只相信 renderer。

文件大小上限放在 main process 的 `validateReference()` 中。该函数已经调用 `stat()`，顺带检查 `fileStat.size` 成本很低。

如果用户选择超过上限的参考图，第一版可以截断到上限并在页面显示一条轻量提示。即使 renderer 没有拦截，main process 也必须拒绝超限请求。

## API 设计

### shared IPC channel

在 `packages/shared/src/ipc.ts` 的 `image` 分组里新增：

```ts
selectReferences: 'image:select-references'
```

### shared ElectronApi

在 `packages/shared/src/api.ts` 里新增：

```ts
selectImageReferences: () => Promise<ImageReference[]>
```

返回值继续复用现有类型：

```ts
export type ImageReference = {
  id: string
  kind: 'local-file'
  path: string
  name?: string
  mimeType?: string
}
```

### preload

在 `apps/desktop/electron/preload.ts` 中暴露：

```ts
selectImageReferences: () => {
  return ipcRenderer.invoke(IPC_CHANNELS.image.selectReferences)
}
```

renderer 只拿到主进程选择后的结构化结果，不直接访问 `dialog`、`fs` 或任意 Node.js API。

## Main Process 设计

### Controller

建议在现有 image generation controller 中注册新的 IPC handler，而不是新建独立 controller。这个 handler 属于图片生成工作流，不涉及全局设置，因此不放到 `SettingsController`。

职责：

- 调用 `dialog.showOpenDialog()`。
- 限制选择类型为图片。
- 支持多选。
- 将结果转换成 `ImageReference[]`。
- 用户取消选择时返回空数组。

建议 filters：

```ts
filters: [
  {
    name: 'Images',
    extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'apng'],
  },
]
```

建议 properties：

```ts
properties: ['openFile', 'multiSelections']
```

返回结构：

```ts
{
  id: randomUUID(),
  kind: 'local-file',
  path: filePath,
  name: path.basename(filePath),
  mimeType: guessMimeType(filePath),
}
```

`mimeType` 可以先通过扩展名推断。它不是后端生成链路的必需字段，但对后续缩略图、校验提示和 UI 展示有帮助。

推断方式使用扩展名映射即可，不需要读取文件 magic bytes，也不需要引入额外依赖：

```ts
const IMAGE_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  '.apng': 'image/apng',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}
```

### Service 校验

`ImageGenerationService.normalizeRequest()` 已经校验：

- 扩展名必须在允许列表里。
- 文件必须可读。
- 路径必须指向文件。
- 参考图数量不能超过 `MAX_IMAGE_REFERENCES`。
- 文件大小不能超过 `MAX_IMAGE_REFERENCE_FILE_SIZE`。

这个校验应该保留在 main service 里。即使文件选择器已经限制格式，也不能只相信 renderer 或 dialog 返回值。

## Renderer 设计

### Page 状态

在 `ImageGenerationPage` 增加：

```ts
const [references, setReferences] = useState<ImageReference[]>([])
```

生成请求从：

```ts
references: []
```

改成：

```ts
references
```

提交成功后：

```ts
setPrompt('')
setReferences([])
```

### 选择参考图

新增处理函数：

```ts
async function selectReferences() {
  const selectedReferences = await window.api.selectImageReferences()

  if (selectedReferences.length === 0) {
    return
  }

  setReferences((currentReferences) => mergeReferences(currentReferences, selectedReferences))
}
```

合并策略按 `path` 去重。重复选择同一张图时不要重复显示，并且保留已有 reference 的 `id`，避免 React 重新 mount 已存在的 chip。

```ts
function mergeReferences(existing: ImageReference[], incoming: ImageReference[]) {
  const existingPaths = new Set(existing.map((reference) => reference.path))
  const newReferences = incoming.filter((reference) => !existingPaths.has(reference.path))

  return [...existing, ...newReferences].slice(0, MAX_IMAGE_REFERENCES)
}
```

### 移除参考图

按 `id` 移除：

```ts
function removeReference(referenceId: string) {
  setReferences((currentReferences) => currentReferences.filter((reference) => reference.id !== referenceId))
}
```

### GenerationForm props

`GenerationForm` 增加：

```ts
references: ImageReference[]
onSelectReferences: () => void | Promise<void>
onRemoveReference: (referenceId: string) => void
```

图片按钮从占位按钮变成真实按钮：

```tsx
<button
  aria-label="添加参考图"
  type="button"
  onClick={() => void onSelectReferences()}
>
```

### 表单 UI

参考图 chip 建议放在 textarea 和底部操作栏之间，属于输入内容的一部分。

结构：

```txt
[ textarea ]

参考图 2
[ image-a.png  x ] [ image-b.webp  x ]

[ 添加参考图 ] [ 生成 ]
```

样式遵循 `DESIGN.md`：

- 使用 `text-base`。
- 使用已有颜色令牌，例如 `text-text-muted`、`text-text-strong`、`bg-fill-hover`、`hover:bg-fill-active`。
- 圆角使用 `rounded-lg`。
- 可点击元素加 `cursor-pointer`。
- 不新增 shadow、ring 或自定义颜色。

生成按钮禁用逻辑保持不变：必须有非空提示词。只有参考图但没有提示词时，不允许生成。

参考图状态只存在于当前页面会话中。刷新页面后丢失，不写入本地存储；v4 不做草稿恢复。

## 数据流

```txt
GenerationForm
  -> onSelectReferences()
  -> window.api.selectImageReferences()
  -> preload.ts
  -> IPC_CHANNELS.image.selectReferences
  -> ImageGenerationController
  -> dialog.showOpenDialog()
  -> ImageReference[]
  -> ImageGenerationPage.references
  -> window.api.startImageGeneration({ prompt, count, size, references })
  -> ImageGenerationService.normalizeRequest()
  -> CodexImageProvider.generateStreaming()
  -> codex exec --image <path>
```

## 错误处理

- 用户取消系统文件选择器：返回空数组，不显示错误。
- 选择了不支持格式：理论上 dialog 会过滤；service 仍会在启动任务时拒绝，并通过现有 `startError` 展示错误。
- 文件被删除、移动或变得不可读：`ImageGenerationService.normalizeRequest()` 在任务启动前报错。
- 文件过大或参考图数量超过上限：main process 拒绝启动任务，并通过现有 `startError` 展示错误。
- 重复选择同一路径：renderer 合并时去重。
- `startImageGeneration()` 抛出异常时，不清空 `prompt` 和 `references`。

## 后续可选增强

### 参考图缩略图

如果文件名 chip 验证稳定，可以再做缩略图。

可选实现：

- 新增受控协议，例如 `artpilot-reference://local/<id>`。
- main process registry 维护 `referenceId -> localPath` 映射。
- renderer 用协议 URL 展示缩略图。

不建议 renderer 直接拼 `file://` 展示本地路径，避免扩大本地文件读取面。

### 拖拽添加

后续可以支持把本地图片拖进 `GenerationForm`。拖拽只作为选择器的补充，不改变 `ImageReference[]` 的核心数据结构。

### 历史任务展示参考图

如果未来希望历史任务展示当时用过哪些参考图，需要新增数据库表或在 `generation_tasks` 里保存序列化 references。v4 MVP 不做，避免把“任务可运行”变成“历史可追溯”的大改造。

如果选择在 `generation_tasks` 中保存，可以新增 `references_json` 列，内容为提交时的 `ImageReference[]` 快照。后续若要支持缩略图或路径失效提示，再考虑独立表。

## 需要修改的文件

- `packages/shared/src/ipc.ts`
- `packages/shared/src/api.ts`
- `apps/desktop/electron/preload.ts`
- `apps/desktop/electron/controllers/imageGenerationController.ts`
- `apps/desktop/src/features/ImageGeneration/index.tsx`
- `apps/desktop/src/features/ImageGeneration/GenerationForm/index.tsx`

## 验收标准

- 点击“添加参考图”会打开系统图片选择器。
- 可以选择一张或多张图片。
- 选中后，输入框内能看到参考图文件名 chip。
- 可以移除单张参考图。
- 移除最后一张参考图后，chip 区域消失。
- 重复选择同一路径不会重复添加。
- 多次点击“添加参考图”会追加选择，不会替换已有参考图。
- 参考图数量超过上限时，不会提交超限请求。
- 参考图文件超过大小上限时，提交任务会显示错误。
- 参考图文件在选择后被删除，提交任务会显示错误。
- 有提示词和参考图时，提交请求中的 `references` 不为空。
- Codex CLI 启动参数包含对应参考图路径。
- 提交成功后清空提示词和参考图。
- 提交失败后保留提示词和参考图。
- 用户取消文件选择不会报错。
- `pnpm typecheck` 通过。
- `pnpm --filter @art-pilot/desktop exec vite build` 通过。
