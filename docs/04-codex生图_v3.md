# 并发图片生成 v1 方案

## 背景

当前图片生成链路在 main process 中明确限制同一时间只能有一个 active image job：

```ts
private activeJob: ActiveImageGenerationJob | null = null
```

`ImageGenerationService.startImageGeneration()` 在发现已有 active job 时会直接拒绝新的生成请求：

```txt
已有图片生成任务正在运行
```

这个限制来自早期 v1 决策：防止用户重复点击“生成”导致多个 Codex 进程并发运行，进而消耗更多额度和本机资源。

现在产品判断发生变化：Codex CLI 进程本身资源占用可接受，用户可以同时启动多个图片生成任务。新的目标是移除单 active job 限制，让多个任务可以并发运行，同时保持任务事件、取消、历史记录和图片恢复不串线。

## 目标

- 允许用户连续点击生成，启动多个并发图片任务。
- 每个任务仍然拥有独立的 Art Pilot `jobId`、Codex `threadId`、子进程、恢复定时器和图片导入状态。
- 每个任务的生命周期事件必须按 `jobId` 更新对应 UI，不影响其它任务。
- 支持按任务取消，而不是只能取消“当前任务”。
- 应用退出或窗口销毁时能正确终止相关的所有未完成任务。
- 对并发数量有明确保护，避免误操作导致大量 Codex 进程同时启动。
- 避免并发任务在 Codex session 图片恢复阶段互相误认图片。

## 非目标

- 不实现任务队列或优先级调度。
- 不实现复杂资源监控；v1 只做简单并发上限保护。
- 不实现跨应用重启后的运行中任务恢复。
- 不改成直接调用图片模型 API。
- 不改变每个 Art Pilot job 内部的生图策略：一个 job 仍对应一个 Codex `exec` 进程。
- 不做额度统计。

## 核心决策

把 main process 的单任务状态改成多任务 Map。

```txt
当前：
ImageGenerationService.activeJob: ActiveImageGenerationJob | null

目标：
ImageGenerationService.activeJobs: Map<string, ActiveImageGenerationJob>
```

每个任务通过 Art Pilot `jobId` 定位：

```txt
jobId
  -> ActiveImageGenerationJob
    -> codexThreadId
    -> childProcess
    -> ownerWebContentsId
    -> recoveryTimer
    -> cleanupTimer
    -> imagePaths
    -> sessionPaths
```

不再用“是否存在 activeJob”阻止新任务。只要请求参数合法，就可以创建新的 job 并启动新的 Codex 进程。

v1 仍需要一个简单的并发保护，避免连续误触或脚本调用创建过多 Codex 子进程。建议默认上限：

```ts
const MAX_ACTIVE_IMAGE_JOBS = 5
```

当 `activeJobs.size >= MAX_ACTIVE_IMAGE_JOBS` 时，拒绝新任务并返回清晰错误：

```txt
当前已有 5 个图片生成任务正在运行，请等待部分任务完成后再试
```

这个上限不是队列，也不改变“允许并发”的产品语义；它只是本地资源保护。

## 后端改造

### `apps/desktop/electron/services/imageGenerationService.ts`

#### active job 存储

将：

```ts
private activeJob: ActiveImageGenerationJob | null = null
```

改为：

```ts
private activeJobs = new Map<string, ActiveImageGenerationJob>()
```

`startImageGeneration()` 删除已有任务检查：

```ts
if (this.activeJob) {
  throw new Error('已有图片生成任务正在运行')
}
```

改成并发上限检查：

```ts
if (this.activeJobs.size >= MAX_ACTIVE_IMAGE_JOBS) {
  logger.warn(
    'rejected image generation because active job limit reached: activeJobs=%d limit=%d owner=%d',
    this.activeJobs.size,
    MAX_ACTIVE_IMAGE_JOBS,
    ownerWebContents.id,
  )
  throw new Error(`当前已有 ${MAX_ACTIVE_IMAGE_JOBS} 个图片生成任务正在运行，请等待部分任务完成后再试`)
}
```

创建任务后写入 Map：

```ts
this.activeJobs.set(jobId, activeJob)
```

如果创建历史任务失败，删除当前 job：

```ts
this.clearActiveJob(jobId)
```

#### 查询和清理

`getActiveJob(jobId)` 改为：

```ts
private getActiveJob(jobId: string) {
  return this.activeJobs.get(jobId) ?? null
}
```

`clearActiveJob(jobId)` 改为：

```ts
const activeJob = this.activeJobs.get(jobId)
if (!activeJob) return

clearTimeout(activeJob.cleanupTimer)
clearInterval(activeJob.recoveryTimer)

this.activeJobs.delete(jobId)
```

所有原来使用 `this.activeJob?.jobId !== jobId` 的逻辑，都应改成从 Map 中按 `jobId` 查找。

#### 取消任务

`cancelImageGeneration(jobId)` 按 jobId 取消单个任务：

```ts
const activeJob = this.getActiveJob(jobId)
if (!activeJob) return

this.cancelActiveJob(activeJob, 'Image generation cancelled')
```

`cancelActiveJob(activeJob, message)` 可以基本保留，仍负责：

- 标记 `status = 'cancelling'`
- 向子进程发送 `SIGTERM`
- 3 秒后升级 `SIGKILL`
- 发送取消事件
- 清理当前 job

#### 应用退出

当前 `before-quit` 只终止一个 active job。

并发后需要改成终止所有 active jobs。这里必须明确退出策略：

v1 选择阻止第一次退出，等待所有 Codex 子进程结束或被 `SIGKILL` 后再真正退出。原因是 `before-quit` 是同步事件，如果只启动 3 秒 timer 而不阻止退出，Electron 可能在 timer 触发前结束，导致部分 Codex 子进程没有走完整取消逻辑。

建议增加退出状态：

```ts
private isQuitting = false
private quitAfterActiveJobsTerminated = false
```

`before-quit` 处理：

```ts
app.on('before-quit', (event) => {
  if (this.activeJobs.size === 0 || this.quitAfterActiveJobsTerminated) {
    return
  }

  event.preventDefault()
  this.isQuitting = true
  this.terminateActiveJobs('Application is quitting')
})
```

终止所有 active jobs：

```ts
private terminateActiveJobs(message: string) {
  for (const activeJob of this.activeJobs.values()) {
    this.cancelActiveJob(activeJob, message)
  }
}
```

每次 `clearActiveJob(jobId)` 后检查是否可以继续退出：

```ts
if (this.isQuitting && this.activeJobs.size === 0) {
  this.quitAfterActiveJobsTerminated = true
  app.quit()
}
```

`cancelActiveJob()` 的 `SIGTERM` / `SIGKILL` 仍按单任务执行，但每个任务都必须最终调用 `clearActiveJob(jobId)`。这样多个任务同时取消时，所有 cleanup timer 都有机会执行。

#### owner webContents 销毁

当前逻辑只判断当前单个 active job：

```ts
if (this.activeJob?.jobId === jobId) {
  this.terminateActiveJob(...)
}
```

并发后建议按窗口维度终止该窗口发起的所有任务：

```ts
for (const activeJob of this.activeJobs.values()) {
  if (activeJob.ownerWebContentsId === ownerWebContents.id) {
    this.cancelActiveJob(activeJob, 'Owner webContents was destroyed')
  }
}
```

也可以只取消当前 `jobId`。如果产品未来支持多窗口，按窗口取消更安全。

## 图片恢复定时器

图片恢复定时器的作用是：在 Codex 进程还没结束时，每 2 秒从 Codex session JSONL 中恢复已经生成出的图片，提前导入图片库并推送 `image-found`。

当前逻辑：

```ts
private startImageRecoveryTimer(activeJob: ActiveImageGenerationJob) {
  activeJob.recoveryTimer = setInterval(() => {
    if (this.activeJob !== activeJob || activeJob.status !== 'running') {
      return
    }

    void this.recoverImagesFromCodexSessions(activeJob)
  }, 2000)
}
```

并发后这里要改为 Map 判断：

```ts
if (this.activeJobs.get(activeJob.jobId) !== activeJob || activeJob.status !== 'running') {
  return
}
```

`recoverImagesFromCodexSessions(activeJob)` 里的单任务判断也要同步调整：

```ts
if (this.activeJobs.get(activeJob.jobId) !== activeJob) {
  return Promise.resolve()
}
```

## 图片恢复并发风险

这是并发改造中最需要注意的地方。

当前图片恢复逻辑优先用 `codexThreadId` 精准读取本次任务的 Codex session；如果 `codexThreadId` 缺失，会 fallback 到 `startedAt` 之后更新过的 session 文件：

```txt
threadId 存在：
  读取对应 threadId 的 session JSONL

threadId 缺失：
  扫描 startedAt 之后更新过的 session JSONL
```

单任务模式下，`startedAt` fallback 风险较低。并发模式下，多个任务时间窗口重叠，仅靠 `startedAt` 可能把其它任务的图片误导入当前任务。

并发 v1 推荐规则：

1. 如果任务已经有 `codexThreadId`，可以启动 2 秒恢复定时器。
2. 如果任务还没有 `codexThreadId`，不要在定时器中使用 `startedAt` fallback 做增量恢复。
3. 进程正常退出时优先使用 `codexThreadId` 做最终恢复。
4. 只有在进程已经退出且仍没有 `codexThreadId` 时，才允许使用 `startedAt` fallback，并记录 warning。

推荐实现方向：

```ts
private recoverImagesFromCodexSessions(
  activeJob: ActiveImageGenerationJob,
  options?: { logEmptyResult?: boolean; allowStartedAtFallback?: boolean }
) {
  if (!activeJob.codexThreadId && !options?.allowStartedAtFallback) {
    return Promise.resolve()
  }

  ...
}
```

定时器调用：

```ts
void this.recoverImagesFromCodexSessions(activeJob, {
  allowStartedAtFallback: false,
})
```

进程退出后的最终恢复：

```ts
await this.recoverImagesFromCodexSessions(activeJob, {
  logEmptyResult: true,
  allowStartedAtFallback: true,
})
```

这样可以保留“图片提前出现”的体验，同时降低并发任务误归属风险。

## 图片导入事务性

`doRecoverImagesFromCodexSessions()` 对每张图片的当前处理顺序是：

```txt
move image to library
  -> save generated_images
  -> register generatedImageRegistry
  -> send image-found
  -> cleanup original Codex image
```

并发改造不改变这个基本流程，但必须明确单张图片失败时的补偿策略。

风险场景：

- `move` 成功，但 `saveImportedImage` 写数据库失败，图片库会出现数据库无记录的孤儿文件。
- `saveImportedImage` 成功，但 `register` 或 `send image-found` 失败，数据库有记录但当前 UI 可能没显示。
- 图片导入失败时，如果 `originalImagePaths` 标记时机不当，下次恢复可能重复导入同一张图。

v1 推荐规则：

1. 只有在图片成功写入 `generated_images` 后，才把原始路径加入“已处理集合”。
2. `move` 成功但数据库写入失败时，尝试把图片从 library 路径移回原路径；如果回滚失败，记录 orphan warning，并保留文件，避免删用户资产。
3. `saveImportedImage` 成功后，`register` 和 `send image-found` 失败不回滚数据库。下一次 `listRecentImageTasks()` 可以从 SQLite 恢复图片。
4. `cleanupImportedImage()` 失败不影响任务完成，只记录 `cleanup_status` / `cleanup_error`。
5. 每张图片导入失败只增加当前 job 的 `importFailureCount`，不得影响其它 job。

回滚实现保持保守，不为回滚再引入复杂的跨 volume move：

```ts
async function rollbackMovedImage(importedImage: ImportedImage) {
  try {
    await rename(importedImage.libraryPath, importedImage.originalCodexPath)
  } catch (error) {
    logger.warn(
      'failed to rollback imported image after database error: jobId=%s source=%s library=%s error=%s',
      jobId,
      importedImage.originalCodexPath,
      importedImage.libraryPath,
      error instanceof Error ? error.message : String(error),
    )
  }
}
```

`moveImageToLibrary()` 当前已经处理了同 volume `rename` 和跨 volume `copy -> verify -> rename -> unlink`。回滚阶段只尝试一次 `rename(libraryPath, originalCodexPath)`：

- 如果成功，图片回到 Codex 原始路径。
- 如果失败，保留 library 文件并记录 orphan warning。
- 不执行 `copyFile + unlink` 回滚，避免二次复制失败时扩大损坏面。
- 不删除 library 文件，避免误删已经成功生成的用户资产。

如果原始路径所在目录不存在，或原路径已经被外部清理，`rename` 会失败并进入 orphan warning。这是可接受结果，后续可以通过日志中的 `libraryPath` 人工定位孤儿文件。

推荐把单张图片导入封装成独立方法，降低主恢复循环的异常面：

```ts
private async importRecoveredImage(activeJob: ActiveImageGenerationJob, imagePath: string) {
  // move -> save -> mark processed -> register -> notify -> cleanup
}
```

如果短期不做完整文件回滚，也必须在日志中明确记录：

```txt
jobId
sourcePath
libraryPath
阶段：move / database / registry / notify / cleanup
```

这样后续可以通过图片库目录和数据库状态排查孤儿文件。

## 前端改造

### `apps/desktop/src/features/ImageGeneration/index.tsx`

当前前端也是单任务模型：

```ts
const [activeJobId, setActiveJobId] = useState<string | null>(null)
const isGenerating = activeJobId !== null
```

并发后应改成多任务集合，并且把“正在提交请求”和“任务正在运行”分开：

```ts
const [activeJobIds, setActiveJobIds] = useState<Set<string>>(() => new Set())
const [submitting, setSubmitting] = useState(false)
const isGenerating = activeJobIds.size > 0
```

生成按钮不再因为 `isGenerating` 禁用，只在 prompt 为空或当前点击正在提交时禁用：

```tsx
isGenerateDisabled={!prompt.trim() || submitting}
```

`submitting` 只是防止同一次快速双击提交重复请求，不是全局单任务限制。一次请求返回或失败后立即恢复。

`started` 事件：

```ts
setActiveJobIds((jobIds) => new Set(jobIds).add(event.jobId))
```

`complete` / `error` 事件：

```ts
setActiveJobIds((jobIds) => {
  const next = new Set(jobIds)
  next.delete(event.jobId)
  return next
})
```

### 任务创建来源

当前使用单个 `latestRequestRef` 保存最近一次请求：

```ts
const latestRequestRef = useRef<... | null>(null)
```

并发时这个值会被后一个任务覆盖，导致早期任务收到 `started` 事件时拿到错误的 prompt、count 或 aspectRatio。

并发后不要再使用 `latestRequestRef` 创建任务卡片。任务卡片只由 `started` 事件创建。

原因是 `ImageGenerationService` 会先发送 `started` 事件，再启动 Codex 子进程，`startImageGeneration()` 的 Promise resolve 可能晚于 `started` 事件。并发场景下如果同时依赖事件和 Promise 返回值，会出现重复创建或状态不一致。

职责边界：

```txt
started 事件：
  创建任务卡片
  写入 prompt / count / size / createdAt
  加入 activeJobIds

startImageGeneration Promise:
  只表示 IPC 调用是否成功提交到 main process
  不创建任务卡片
  不写 activeJobIds
  成功后清空输入框并关闭 submitting
  失败后展示 startError 并关闭 submitting
```

因此需要扩展 `started` 事件，让 main process 直接携带创建任务时已经归一化后的请求信息：

```ts
type ImageGenerationStartedEvent = {
  type: 'started'
  jobId: string
  prompt: string
  count: number
  size?: ImageGenerationSize
  createdAt: number
}
```

`createdAt` 明确使用 `Date.now()` 的 epoch milliseconds，和当前 `ActiveImageGenerationJob.startedAt`、`generation_tasks.created_at`、`ImageHistoryTask.createdAt` 保持一致。不要传 `Date` 对象，也不要传秒级 timestamp。

这样 renderer 不需要依赖 `latestRequestRef`，并发任务也不会串线。

推荐 `startGeneration()` 流程：

```ts
async function startGeneration() {
  const trimmedPrompt = prompt.trim()

  if (!trimmedPrompt || submitting) {
    return
  }

  setSubmitting(true)
  setStartError(null)

  try {
    await window.api.startImageGeneration({
      prompt: trimmedPrompt,
      count: imageCount,
      size: aspectRatioSizeMap[aspectRatio],
      references: [],
    })
    setPrompt('')
  } catch (error) {
    setStartError(error instanceof Error ? error.message : String(error))
  } finally {
    setSubmitting(false)
  }
}
```

注意：这里故意忽略 Promise 返回的 `{ jobId }`，避免和 `started` 事件形成双数据源。`ImageGenerationStartResult` 可以暂时保留，作为调试或未来扩展使用。

### 取消交互

当前页面只有一个“取消当前任务”按钮。

并发后取消动作必须绑定到具体任务。页面顶部的“取消当前任务”按钮应删除，把取消按钮放到每个 running 任务卡片上。

`RecentTaskList` 增加 props：

```ts
export function RecentTaskList({
  tasks,
  onCancelTask,
}: {
  tasks: RecentTask[]
  onCancelTask: (jobId: string) => void | Promise<void>
})
```

`RecentTaskItem` 接收同一个 callback：

```ts
function RecentTaskItem({
  task,
  onCancelTask,
}: {
  task: RecentTask
  onCancelTask: (jobId: string) => void | Promise<void>
})
```

只在 running 任务上展示取消按钮：

```txt
RecentTaskList
  running task card
    -> 取消
```

取消时传入对应 `jobId`：

```ts
void onCancelTask(task.jobId)
```

页面实现：

```ts
async function cancelGeneration(jobId: string) {
  await window.api.cancelImageGeneration(jobId)
}
```

收到 `error` 且 `reason === 'cancelled'` 后：

```ts
setRecentTasks((tasks) =>
  tasks.map((task) =>
    task.jobId === event.jobId
      ? { ...task, status: 'cancelled', error: event.error }
      : task,
  ),
)

setActiveJobIds((jobIds) => {
  const next = new Set(jobIds)
  next.delete(event.jobId)
  return next
})
```

### 事件路由和孤儿事件

事件处理必须以 `event.jobId` 为唯一路由键。

正常情况下，main process 在同一个 IPC channel 中先发 `started`，再发 `image-found` / `message` / `complete`。Electron 对同一 sender 的消息保持顺序，因此 mounted 状态下通常不会先收到 `image-found` 再收到 `started`。

但前端仍要处理边界情况：

- 页面刚 mount 时可能错过之前运行任务的 `started` 事件。
- 热重载或页面切换可能让当前内存任务列表为空。
- `started` 事件处理异常时，后续事件会找不到对应任务。

v1 推荐实现一个 `upsertTaskFromEvent` 辅助：

```ts
function upsertTaskFromStartedEvent(event: StartedEvent) {
  // started 是唯一完整创建任务的实时事件。
}

function ensureTaskExists(jobId: string) {
  // 非 started 事件找不到任务时，创建最小占位任务并触发一次 history reload。
}
```

非 `started` 事件找不到任务时，不应静默丢弃。推荐行为：

1. 记录 warning：`unknown image generation event jobId=... type=...`。
2. 在列表头部创建最小占位任务：

```ts
{
  jobId,
  prompt: '生成任务',
  count: 0,
  aspectRatio: '1:1',
  status: 'running',
  createdAt: Date.now(),
  images: [],
}
```

占位任务插入头部，原因是它代表当前刚收到实时事件的任务，用户最可能需要立即看到它。插入后仍由 `createdAt` 参与后续排序和历史合并。

3. 继续应用当前事件，避免图片或终态直接丢失。
4. 异步调用 `listRecentImageTasks()` 刷新一次历史数据，用数据库里的真实 prompt / count / size 修正占位任务。

history reload 回来后按 `jobId` 合并，不做简单整表替换，避免覆盖还没有写入数据库但正在运行的占位任务：

```txt
history 中存在同 jobId：
  用数据库里的 prompt / count / size / createdAt / images 修正占位任务
  保留实时事件中更新到的 running message，除非数据库已有终态

history 中不存在同 jobId：
  保留占位任务
  等后续 started / message / image-found / complete / error 事件继续更新
```

合并后的列表按 `createdAt DESC` 排序；如果占位任务没有真实 `createdAt`，使用创建占位时的 `Date.now()`。

这样即使事件流在 UI 层短暂缺上下文，也能通过 SQLite 历史恢复到正确状态。

## IPC 类型改动

建议更新 `packages/shared/src/imageGeneration.ts` 中 `started` 事件：

```ts
{
  type: typeof IMAGE_GENERATION_EVENT_TYPES.started
  jobId: string
  prompt: string
  count: number
  size?: ImageGenerationSize
  createdAt: number
}
```

main process 发送 started 事件时使用归一化后的 request：

```ts
this.sendToOwner(activeJob, {
  type: IMAGE_GENERATION_EVENT_TYPES.started,
  jobId,
  prompt: normalizedRequest.prompt,
  count: activeJob.expectedCount,
  size: normalizedRequest.size,
  createdAt: activeJob.startedAt,
})
```

renderer 用事件本身创建任务卡片，不再依赖 `latestRequestRef`。

`ImageGenerationStartResult` 可以继续返回 `{ jobId }`，但 renderer 不应把它作为任务创建来源。它只表示 main process 接受了启动请求。真正的 UI 任务状态以 `generationEvent.started` 为准。

如果未来希望彻底消除双数据源，也可以把 `startImageGeneration()` 的返回类型改成：

```ts
type ImageGenerationStartResult = {
  accepted: true
}
```

v1 为了减少破坏性改动，可以先保留 `{ jobId }`，但在前端代码中不消费它。

## 数据库影响

现有数据库结构可以支持并发任务。

`generation_tasks` 以 `id` 为主键，每个 job 独立一行：

```txt
id
codex_thread_id
prompt
count
size
status
created_at
completed_at
```

`generated_images` 通过 `task_id` 关联任务：

```txt
task_id -> generation_tasks(id)
```

因此并发改造不需要新增表或字段。

需要保证的是：图片恢复和导入必须始终使用当前 `activeJob.jobId` 写入 `task_id`，不能因为 session fallback 误认图片。

## 图片 URL Registry 生命周期

当前 `generatedImageRegistry` 不在 `clearActiveJob()` 中清理，原因是 renderer 在任务完成后仍会用 `artpilot-image://...` URL 展示刚生成的图片。

单任务模式下这个问题不明显。并发后如果用户连续生成大量任务，registry 会持续累积：

```txt
50 个任务 * 每任务 8 张图 = 400 条 registry 记录
```

v1 需要明确 registry 生命周期策略。

推荐短期策略：

- 不在任务 complete 后立即清理，避免最近任务图片失效。
- registry 只保留最近 N 个任务的图片映射，建议 `MAX_REGISTERED_IMAGE_TASKS = 100`。
- `ImageHistoryService.listRecentTasks(limit)` 读取历史时会重新注册最近任务图片，因此被淘汰的旧任务在再次进入历史列表时可以恢复。
- 清理粒度按 taskId，而不是单张图片。
- pruning 在 renderer 可见任务集合变化后触发，而不是只在 main process 的 `clearActiveJob()` 中盲清。

建议给 `generatedImageRegistry` 增加接口：

```ts
generatedImageRegistry.pruneTaskIds(visibleTaskIds)
generatedImageRegistry.unregisterTask(taskId)
```

推荐触发时机：

1. `ImageHistoryService.listRecentTasks(limit)` 完成后：  
   用返回的最近任务 id 调用 `pruneTaskIds(recentTaskIds)`。这是最稳定的时机，因为 main process 知道 renderer 这次能看到哪些历史任务。

2. `ImageGenerationService.clearActiveJob(jobId)` 后：  
   不直接只按 active jobs pruning，因为 main process 不知道 renderer 当前 recentTasks 列表。可以只记录该任务结束，并等待下一次 `listRecentTasks()` 做 pruning。

3. 如果实现一个 renderer 主动上报可见任务的 IPC，才可以用 `activeJobs.keys() + visibleRecentTaskIds` 作为 pruning 白名单。v1 不建议为了 registry 清理新增这个 IPC。

因此 v1 的最小落地方案：

```txt
listRecentTasks(limit)
  -> 查询最近任务
  -> 重新 register 这些任务的图片
  -> generatedImageRegistry.pruneTaskIds(recentTaskIds)
  -> 返回给 renderer
```

这样 pruning 和“最近任务列表可见范围”绑定，避免 `clearActiveJob()` 在任务刚完成但 renderer 仍展示图片时过早清理 URL。

如果 v1 暂不实现 registry pruning，也必须在方案和代码注释中说明：

- registry 只保存字符串路径和索引，单条记录内存占用很小。
- 当前 UI 默认只展示最近任务，实际增长有限。
- 后续历史数量扩大时必须补清理。

## 日志与排错

并发后日志里必须持续带上 `jobId`，必要时也带上 `ownerWebContentsId` 和 `codexThreadId`。

v1 不要求把 logger 改成 JSON structured logging，但需要约定日志格式，降低并发排查成本：

```txt
jobId=<jobId> owner=<webContentsId> thread=<codexThreadId|unknown> activeJobs=<count> message...
```

如果某条日志没有 `jobId`，必须是服务级日志，例如并发上限、应用退出、controller 注册。

当前 `createLogger()` 已经统一加 namespace，v1 不改 logger 实现。为了减少手写前缀出错，建议在 `imageGenerationService.ts` 内部加一个小 helper：

```ts
private formatJobLogContext(activeJob: ActiveImageGenerationJob) {
  return `jobId=${activeJob.jobId} owner=${activeJob.ownerWebContentsId} thread=${activeJob.codexThreadId ?? 'unknown'} activeJobs=${this.activeJobs.size}`
}
```

使用方式：

```ts
logger.info('%s image generation job running: pid=%s', this.formatJobLogContext(activeJob), String(childProcess.pid ?? 'unknown'))
```

这样既保留当前 logger，也让并发日志有稳定上下文。不要为这个改造引入新的日志库。

关键日志点：

- job created
- codex process running
- codex thread started
- image recovered
- image import failed
- job complete
- job cancelled
- job error
- job cleared

创建和清理任务时必须记录 `activeJobs.size`，方便排查并发数量。

## 超时与错误路径

并发改造不能让一个任务的超时或错误影响其它任务。

当前 Codex provider 已经有独立回调：

```txt
onExit
onError
onTimeout
```

v1 要求：

- 每个 active job 绑定自己的 Codex 子进程和 timeout 链路。
- 某个任务 `onTimeout` 时，只调用该 jobId 对应的 `handleCodexError(jobId, ..., 'timeout')`。
- timeout 后必须 `clearActiveJob(jobId)`。
- 多个任务同时 timeout 时，每个任务独立发送 error event。

所有错误路径都需要审计是否会清理 job：

| 阶段 | 错误处理要求 |
| --- | --- |
| `normalizeRequest` 失败 | 不创建 job，不需要清理。 |
| `createTask` 失败 | 已创建 job，必须 `clearActiveJob(jobId)` 后再 throw。 |
| `generateStreaming` 启动失败 | 标记任务 error，发送 error event，`clearActiveJob(jobId)`。 |
| Codex process error | `handleCodexError()`，最终 `clearActiveJob(jobId)`。 |
| Codex timeout | `handleCodexError()`，最终 `clearActiveJob(jobId)`。 |
| Codex 非 0 exit | `handleCodexError()`，最终 `clearActiveJob(jobId)`。 |
| 图片恢复无结果 | 标记任务 error，最终 `clearActiveJob(jobId)`。 |
| 用户取消 | 发送 cancellation event，最终 `clearActiveJob(jobId)`。 |
| 应用退出取消 | 等待所有 job 清理完再真正退出。 |

注意：当前代码中 `createTask` 失败已经会 `clearActiveJob(jobId)` 并 throw，不会发送 `started` 或 error event。并发改造后要保留这个语义。

## 验证计划

### 类型与构建

```bash
pnpm typecheck
pnpm --filter @art-pilot/desktop exec vite build
```

### 手动验证

1. 连续点击生成两次，确认两个任务都进入 running。
2. 两个任务完成后，最近任务列表中都有独立图片。
3. 任务 A 的图片不会出现在任务 B 中。
4. 取消任务 A 时，任务 B 继续运行。
5. 任务 A cancelled 后，任务 B 仍能 complete。
6. 应用退出时，所有 running 任务都会被取消。
7. 在没有 `codexThreadId` 的异常场景下，日志出现 fallback warning，且不会在定时器阶段误导入图片。
8. 快速连续点击生成 5 次，确认最多只启动 `MAX_ACTIVE_IMAGE_JOBS` 个任务。
9. 达到并发上限后再次点击生成，确认 UI 显示明确错误，已有任务不受影响。
10. 取消任务 A 后立即启动任务 C，确认 A cancelled、C running、其它任务不受影响。
11. 在任务 A 的图片恢复定时器运行期间启动任务 B，确认图片不串线。
12. 模拟 `codexThreadId` 始终未返回，确认定时器阶段不使用 `startedAt` fallback，最终退出阶段才 fallback 并记录 warning。
13. 触发单个任务 timeout，确认只影响该任务。
14. 在任务运行中刷新 renderer 或切换页面，确认历史 reload 可以恢复任务卡片和图片。
15. 模拟 `image-found` 到达时前端找不到 task，确认会创建占位任务并触发历史刷新，不静默丢图。
16. 连续生成 50 个历史任务后，检查 `generatedImageRegistry` 是否按策略清理或内存增长在预期内。

## 改造难度评估

整体难度中等。

后端不是大重构，但需要把 `ImageGenerationService` 中所有单任务状态改成按 `jobId` 定位。主要改动集中在：

- `activeJob` -> `activeJobs Map`
- `MAX_ACTIVE_IMAGE_JOBS` 并发上限
- cancel / clear / get / terminate
- before-quit 阻止退出并等待所有任务清理
- recovery timer 判断
- session 恢复 fallback 策略
- 单张图片导入失败补偿
- registry 生命周期控制

前端需要同步从单 active job 改成多 active jobs，否则即使后端允许并发，UI 仍会禁用生成按钮，且 `latestRequestRef` 会导致任务元信息串线。前端改造必须覆盖：

- `activeJobIds: Set<string>`
- `submitting` 防重复点击
- `started` 事件作为任务卡片唯一创建来源
- `RecentTaskList` 每个 running 卡片独立取消
- unknown job event 的占位任务和历史刷新

最大风险不是 Codex 进程本身，而是图片恢复归属。只要并发模式下避免在定时器阶段使用 `startedAt` fallback，风险可以控制在可接受范围。
