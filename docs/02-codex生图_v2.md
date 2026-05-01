# Codex 生图 v2 方案

## 背景

v1 方案基于一个假设：`codex exec --json` 的 stdout 会稳定输出图片完成事件，例如 `image_generation_end.saved_path`，主进程可以实时解析 stdout 并立即推送 `image-found`。

实际验证后，这个假设不成立。当前 Codex CLI stdout 更像“执行过程事件流”，常见输出是：

```jsonl
{"type":"thread.started","thread_id":"019de161-36f3-7853-b6bd-aae6976aad6a"}
{"type":"turn.started"}
{"type":"item.completed","item":{"type":"agent_message","text":"..."}}
{"type":"item.started","item":{"type":"command_execution","command":"..."}}
{"type":"item.completed","item":{"type":"command_execution","aggregated_output":"..."}}
{"type":"turn.completed","usage":{...}}
```

这个 stdout 可以告诉我们 Codex thread 已启动、模型回合已结束、子命令执行过，但不能稳定告诉我们图片保存路径。图片真实结果仍会写入 Codex 本地 session JSONL，例如：

```txt
~/.codex/sessions/2026/05/01/rollout-2026-05-01T10-32-17-019de161-36f3-7853-b6bd-aae6976aad6a.jsonl
```

其中可能包含：

```txt
type=event_msg
payload.type=image_generation_end
payload.call_id=ig_030999...
payload.saved_path=/Users/mac/.codex/generated_images/019de161-.../ig_030999....png
```

因此 v2 的核心变化是：stdout 只作为任务生命周期信号；图片发现统一从 Codex session JSONL 中恢复。

## 目标

- 适配当前 Codex CLI stdout 格式，不再依赖 stdout 中出现 `image_generation_end`。
- 将 `doRecoverImagesFromCodexSessions` 从“兜底流程”升级为“图片发现主流程”。
- 在 Codex 进程退出后读取 session JSONL，恢复 `image_generation_end.saved_path` 并推送 `image-found`。
- 保留 `thread.started` 作为定位 session 文件和 generated_images 目录的关键 ID。
- 避免直接扫描所有 `~/.codex/generated_images` 新文件造成误归属。
- 避免解析或转发 JSONL 中可能很大的 `result` base64 字段。

## 非目标

- 不改成直接调用图片模型 API。
- 不并发启动多个 Codex 进程来生成多张图。
- 不在 v2 实现跨应用重启后的任务恢复。
- 不把 Codex session JSONL 的完整内容透传给 renderer。
- 不依赖 `mtime` 目录扫描作为主链路；它只能作为 threadId 缺失时的 fallback。

## 核心决策

v2 的职责拆分如下：

```txt
codex exec --json stdout
  -> thread.started
  -> turn.started / item.started / item.completed
  -> turn.completed
  -> process close

Codex session JSONL
  -> session_meta
  -> event_msg payload.type=image_generation_end
  -> payload.saved_path
```

stdout 的职责：

- 获取 `codexThreadId`。
- 记录 agent message，用于 UI 过程提示和失败兜底文案。
- 监听 stdout/stderr 活动，刷新 timeout。
- 观察 `turn.completed`，但不把它当作图片完成信号。

session JSONL 的职责：

- 在进程退出后读取图片结果。
- 解析 `event_msg.payload.type === "image_generation_end"`。
- 优先使用 `payload.saved_path`。
- 如果缺少 `saved_path`，但有 `sessionId/threadId` 和 `call_id`，推导：

```txt
~/.codex/generated_images/<threadId>/<call_id>.png
```

## 运行流程

v2 主流程：

```txt
renderer
  -> image:generate-start

main
  -> create activeJob
  -> send started
  -> spawn codex exec --json

codex stdout
  -> thread.started
  -> activeJob.codexThreadId = thread_id
  -> send codex-thread-started
  -> message events only for UI text
  -> turn.completed only records lifecycle

codex process close code === 0
  -> doRecoverImagesFromCodexSessions(activeJob)
  -> register recovered image paths
  -> send image-found for each recovered image
  -> send complete

codex process close code !== 0
  -> send error with stderr tail
```

关键点：`complete` 必须等进程 `close` 后再发。`turn.completed` 只表示 Codex 回合完成，不代表 session 文件已经完成写入，也不代表图片路径已经被服务端 stdout 事件暴露。

## 模块改动

### `apps/desktop/electron/utils/codexCli.ts`

`runCodexExecStreaming` 继续负责启动 Codex CLI、读取 stdout/stderr、管理 timeout。

需要调整的方向：

- 保留 `thread.started` 解析，输出 `thread-started`。
- 保留 agent message 解析，输出 `message`。
- 保留 `turn.completed` 解析，输出 `task-complete` 或仅记录日志。
- 不解析 stdout 中的 `image_generation_end`；图片结果只从 session JSONL 恢复。

建议事件语义：

```ts
export type CodexStreamEvent =
  | { type: 'thread-started'; threadId: string }
  | { type: 'message'; text: string; revisedPrompt?: string; callId?: string }
  | { type: 'task-complete' }
```

### `apps/desktop/electron/services/imageGenerationService.ts`

`doRecoverImagesFromCodexSessions` 是 v2 核心流程。

当前逻辑只在 `activeJob.imagePaths.length === 0` 时恢复：

```ts
if (activeJob.imagePaths.length === 0) {
  await this.recoverImagesFromCodexSessions(activeJob, true)
}
```

v2 应改成进程正常退出后总是恢复一次：

```ts
await this.recoverImagesFromCodexSessions(activeJob, true)

if (activeJob.imagePaths.length === 0) {
  this.handleCodexError(
    jobId,
    activeJob.lastMessage || 'Codex 任务已结束，但没有生成任何图片',
    'api-error',
  )
  return
}
```

这样即使 stdout 曾提前发现图片，也能补齐 session JSONL 中的遗漏图片；如果 stdout 完全没有图片事件，也能走同一条主链路。

`startImageRecoveryTimer` 可以保留，但职责要弱化：

- v2 不要求 2 秒轮询实时发现图片。
- 如果保留轮询，它只是“尽早展示”的优化。
- 最终准确性以进程退出后的最后一次 session 恢复为准。

### `apps/desktop/electron/utils/generatedImages.ts`

当前 `findCodexGeneratedImagesFromSessions(sinceMs)` 通过 `mtime >= startedAt` 找所有更新过的 session，然后从中提取图片路径。

v2 建议新增按 threadId 精准恢复的接口：

```ts
export async function findCodexGeneratedImagesFromSessions(options: {
  sinceMs: number
  threadId?: string
}): Promise<string[]>
```

查找优先级：

1. 如果有 `threadId`，优先定位包含 threadId 的 session 文件：

```txt
~/.codex/sessions/**/rollout-*<threadId>.jsonl
```

2. 从这个 session JSONL 中解析 `image_generation_end.saved_path`。

3. 如果 JSONL 中有 `call_id` 但没有 `saved_path`，推导：

```txt
~/.codex/generated_images/<threadId>/<call_id>.png
```

4. 如果 session JSONL 没读到图片，但 generated_images 目录存在，可扫描：

```txt
~/.codex/generated_images/<threadId>/*
```

5. 如果没有 `threadId`，才 fallback 到 `mtime >= sinceMs` 的 session 扫描。

这样可以避免一次任务误读到同一时间段内其他 Codex 会话生成的图片。

## JSONL 解析规则

Codex session JSONL 里可能包含大字段：

- `payload.result`
- `payload.output`
- `image_generation_call.result`

这些字段可能包含 base64 图片，单行可能达到数 MB。v2 解析时必须遵守：

- 不把 `result` 写入日志。
- 不通过 IPC 发送 `result` 给 renderer。
- 不在错误信息里拼接整行 JSONL。
- 只提取 `type`、`payload.type`、`payload.call_id`、`payload.saved_path`、`payload.id`。

最低可接受实现：

```ts
JSON.parse(line, (key, value) => (key === 'result' ? undefined : value))
```

更稳的实现：

- 先用 `line.includes('image_generation_end')` 过滤。
- 只对命中的少量行做 JSON.parse。
- 后续如果遇到内存问题，再改为轻量字段提取或流式 parser。

## 图片路径恢复策略

优先级如下：

1. `image_generation_end.saved_path`

最可靠，直接来自 Codex session。

2. `threadId + call_id`

当 `saved_path` 缺失时推导：

```ts
path.join(homedir(), '.codex', 'generated_images', threadId, `${callId}.png`)
```

3. `~/.codex/generated_images/<threadId>` 目录扫描

只在 session 事件缺字段或 session 文件写入异常时使用。扫描范围必须限制在当前 threadId 目录内。

4. `mtime >= startedAt` 全局 session 扫描

仅在没有 `threadId` 的情况下使用。这个 fallback 可能误归属，因此不能优先使用。

## UI 事件语义

对 renderer 来说，v2 仍沿用 v1 的事件模型：

```ts
type ImageGenerationEvent =
  | { type: 'started'; jobId: string; count: number; size?: ImageGenerationSize }
  | { type: 'codex-thread-started'; jobId: string; codexThreadId: string }
  | { type: 'message'; jobId: string; codexThreadId?: string; text: string; metadata?: unknown }
  | { type: 'image-found'; jobId: string; codexThreadId?: string; index: number; imagePath: string; imageUrl: string; callId?: string }
  | { type: 'complete'; jobId: string; codexThreadId?: string; imagePaths: string[]; sessionPaths: string[] }
  | { type: 'error'; jobId: string; codexThreadId?: string; error: string; reason: ImageGenerationErrorReason }
```

但事件到达时序会变化：

- v1 预期图片可在 stdout 中实时到达。
- v2 图片通常在进程退出后集中恢复并推送。
- 如果保留恢复 timer，图片可能提前出现，但不能依赖它一定提前出现。

renderer 应继续按 `image-found` 更新 slot。`complete` 只表示主进程已经完成最终恢复，不表示一定达到了请求的 `count`。

## 错误处理

正常退出但没有图片：

```txt
reason=api-error
error=activeJob.lastMessage || 'Codex 任务已结束，但没有生成任何图片'
```

进程非 0 退出：

```txt
reason=process-crashed
error=stderrTail || `codex exec exited with code ${code}`
```

用户取消：

```txt
reason=cancelled
error=Image generation cancelled
```

超时：

```txt
reason=timeout
error=Image generation timed out
```

取消中的任务不应再恢复图片，也不应发送 `complete`。

## 迁移步骤

1. 调整 `handleCodexExit`：`code === 0` 后总是调用 `recoverImagesFromCodexSessions(activeJob, true)`。

2. 调整 `doRecoverImagesFromCodexSessions`：调用 session 恢复时传入 `activeJob.codexThreadId`，优先按 threadId 查找。

3. 扩展 `generatedImages.ts`：新增按 `threadId` 查 session 文件和 generated_images 目录的能力。

4. 删除 `codexCli.ts` 的图片事件职责：stdout 解析只保留 thread、message、task-complete。

5. 调整日志文案：从“recovered image paths from codex session files”改为中性表达，例如“loaded image paths from codex session files”，避免主流程看起来像异常兜底。

6. 保留 `sessionPaths` 返回，用于调试和审计；优先返回当前 threadId 对应 session 文件。

7. 运行验证：

```bash
pnpm typecheck
pnpm --filter @art-pilot/desktop exec vite build
```

## 验证用例

### stdout 没有图片事件

输入：

```bash
printf '请使用 ImageGen skill 根据以下提示生成图片，生成一张最简单的太阳动画图' \
  | /Applications/Codex.app/Contents/Resources/codex exec --json --skip-git-repo-check --sandbox workspace-write --color never -
```

预期：

- stdout 出现 `thread.started` 和 `turn.completed`。
- 进程退出后，主进程按 `thread_id` 找到 session JSONL。
- 从 session JSONL 的 `image_generation_end.saved_path` 恢复图片。
- renderer 收到 `image-found` 和 `complete`。

### session 有 call_id 但没有 saved_path

预期：

- 使用 `~/.codex/generated_images/<threadId>/<callId>.png` 推导路径。
- 推导路径存在时发送 `image-found`。
- 推导路径不存在时忽略该条，不让整个 job 崩溃。

### 多张图片

预期：

- 同一个 session JSONL 中多个 `image_generation_end` 按出现顺序恢复。
- 去重后逐个注册到 `generatedImageRegistry`。
- `index` 按恢复顺序分配。

### 同时有其他 Codex 会话

预期：

- 有 `codexThreadId` 时只读取当前 thread 对应 session 和 generated_images 目录。
- 不读取同时间段其他 session 的图片。

## 最终结论

v2 不再把 `codex exec --json` stdout 当作图片结果 API。

正确边界是：

```txt
stdout = lifecycle and progress
session JSONL = durable result source
generated_images/<threadId> = path inference fallback
```

实现上，`doRecoverImagesFromCodexSessions` 应成为图片发现核心流程；`handleCodexExit` 是最终收口点；stdout 只负责尽早拿到 `codexThreadId` 和过程消息。
