# Art Pilot Logging Architecture Guide

本文档是 Art Pilot 的系统级日志架构规范，适用于后续所有模块、功能和重构。它不针对某一次修复，而是规定团队在设计、实现、审查日志时应该遵循的统一方法。

日志的目标不是“多输出一些信息”，而是在应用运行异常、用户反馈问题、功能行为不符合预期时，帮助开发者稳定地回答：

1. 事件发生在哪个模块、哪个进程、哪个边界？
2. 当前操作处于哪个阶段？
3. 失败是否影响用户结果，还是已经被恢复？
4. 能否把同一次操作的多条日志关联起来？
5. 日志是否可以安全地长期保存在用户机器上？

## 设计原则

### 1. 边界优先

日志优先放在系统边界，而不是每一行业务逻辑中。

系统边界包括：

- 应用生命周期边界：启动、ready、退出、窗口创建、窗口关闭、renderer 加载。
- 进程边界：renderer、preload、main process、IPC。
- 外部资源边界：文件系统、数据库、系统 dialog、clipboard、shell、custom protocol。
- 外部进程边界：Codex CLI、子进程启动、输出、退出、超时。
- 异步任务边界：任务创建、运行、完成、失败、取消、恢复、清理。

### 2. 状态变化优先

日志应该描述“状态发生了什么变化”，而不是重复解释代码正在执行哪一行。

好的日志：

```ts
logger.info('image generation job started: jobId=%s owner=%d references=%d', jobId, ownerId, referenceCount)
```

差的日志：

```ts
logger.info('calling startImageGeneration')
```

### 3. 可关联优先

同一次用户操作、同一个后台任务、同一个 IPC 调用的日志必须能串起来。

常用关联字段：

- `jobId`: 长任务、图片生成任务。
- `imageId`: 已落库图片。
- `codexThreadId`: Codex 会话。
- `sender`: renderer webContents id。
- `channel`: IPC channel。
- `pid`: 子进程。
- `durationMs`: 耗时。
- `reason`: 失败、取消或 fallback 原因。

### 4. 摘要优先

日志默认记录摘要，不记录完整 payload。

推荐记录：

- 数量：`references=3`
- 长度：`promptLength=142`
- 枚举：`status=running`
- 标识符：`jobId=...`
- 尺寸：`width=1024 height=1024`
- 大小：`bytes=384120`

避免记录：

- 完整 prompt
- 图片 base64
- 用户文件内容
- 完整本地路径
- token、API key、cookie、认证输出
- 未脱敏 URL query

### 5. 生产可保留

`info`、`warn`、`error` 默认可能进入生产持久日志。写这些级别时，要假设用户可能会把日志发给开发者或第三方协作人员。

如果某些信息只适合本机临时排查，放到 `debug` 或 `verbose`，并确保默认生产环境不会长期写入。

## 日志架构分层

Art Pilot 是 Electron monorepo，日志职责按进程和层级区分。

### Renderer

Renderer 负责 UI 状态和用户交互。

适合记录：

- UI 级错误摘要。
- 用户动作被触发的轻量摘要。
- 订阅事件找不到目标状态等前端状态异常。

不适合记录：

- 文件系统细节。
- 原始 prompt。
- 图片内容。
- 需要长期持久化的诊断日志，除非通过受控 API 上报给 main process。

默认策略：

- renderer 可以先使用 `console.warn/error` 辅助开发。
- 如果后续引入 renderer logger，必须限制可写字段，并禁止把敏感 UI payload 直接传给 main process 持久化。

### Preload

Preload 是安全桥，只暴露受控 API。

适合记录：

- 通常不在 preload 记录业务日志。
- 只有桥接层本身出现安全校验、API shape 兼容、事件订阅异常时才记录。

原则：

- preload 不应该成为业务 telemetry 聚合点。
- 不记录 renderer 传入的完整对象。
- 不扩大暴露给 renderer 的 Node/Electron 能力。

### Main Process Controllers

Controllers 是 IPC 入口，负责把 renderer 调用转为 service 调用。

适合记录：

- handler 注册。
- 用户动作请求摘要。
- 参数规范化后的安全摘要。
- 可恢复的无效调用。

不适合记录：

- 大段业务流程。
- 完整 request payload。
- 文件内容或完整用户输入。

统一 IPC 结果日志应该放在 base controller 层：

- 成功：`channel`, `sender`, `durationMs`
- 失败：`channel`, `sender`, `durationMs`, `error`

具体 controller 只补充“这个用户动作是什么”的语义日志。

### Main Process Services

Services 是业务逻辑和 Node.js 集成层，是主日志来源。

适合记录：

- 业务状态机变化。
- 数据库读写关键阶段。
- 文件导入、移动、清理结果。
- 外部命令启动、输出阶段、结束、超时。
- fallback、恢复、回滚。

原则：

- service 日志需要带业务关联字段。
- 低频主流程用 `info`。
- 高频循环和细节用 `debug`。
- 恢复路径用 `warn`。
- 当前操作失败用 `error`。

### Shared Package

`packages/shared` 只放跨进程类型、常量、channel 名称，不放运行时日志逻辑。

可以放：

- 日志事件字段类型，如果未来需要跨进程结构化日志。
- IPC channel 常量。
- 共享状态枚举。

不应该放：

- Electron logger 实现。
- Node.js 文件日志逻辑。
- DOM/renderer logger 实现。

## 日志级别

### `debug`

用于开发期细节、高频事件、临时定位信息。默认不作为生产排障的主依据。

适合：

- 参数数量、长度、枚举值。
- 高频事件摘要。
- registry lookup hit/miss。
- JSONL event type。
- 轮询、恢复扫描、事件推送细节。

不适合：

- 必须在生产包中保留的关键诊断线索。
- 用户可感知的主流程结果。

### `info`

用于低频、高价值、正常发生的状态变化。`info` 是生产持久日志的主力级别，必须克制。

适合：

- app ready。
- main window created。
- renderer loaded。
- IPC completed。
- job started/completed/cancelled。
- database opened/schema ensured。
- settings updated by key name。
- external process spawned/closed。
- image imported with safe metadata。

不适合：

- 高频循环。
- 完整路径。
- 完整 prompt。
- 大对象 dump。

### `warn`

用于偏离主路径但应用仍能继续的情况。

适合：

- fallback 被触发。
- 无效输入被拒绝。
- owner window 不存在。
- clipboard 候选文件被跳过。
- cleanup 失败但主结果已保存。
- stale event 被忽略。
- graceful cancel 超时后改为 force kill。

不适合：

- 正常且常见的用户取消行为，除非它对排查有价值。
- 已经导致当前操作失败的问题。

### `error`

用于导致当前操作失败、任务失败、启动失败或数据状态不确定的问题。

适合：

- IPC handler failed。
- renderer load failed。
- child process spawn/runtime error。
- job failed。
- database write failed。
- rollback failed。
- protocol handler unexpected failure。

要求：

- 必须带错误原因。
- 必须带可关联上下文。
- 日志后不能静默吞错；调用方仍要得到失败结果或错误事件。

### `verbose`

用于开关控制的深度排查。默认不依赖它来理解主流程。

适合：

- 本机临时排查所需的更多内部状态。
- 较详细但可能敏感的路径信息。
- 只有开发者主动开启时才需要的上下文。

## 模块接入规范

每个新模块在设计时都要回答以下问题。

### 1. 模块边界是什么？

确认模块是否跨越：

- IPC
- 文件系统
- 数据库
- 外部进程
- 系统 API
- 长任务
- 用户输入

跨越越多，越需要明确日志点。

### 2. 模块的主状态机是什么？

列出主流程状态。

示例：

```txt
requested -> validated -> started -> running -> completed
requested -> validated -> started -> failed
requested -> started -> cancelling -> cancelled
```

每个重要状态变化至少应该有一条可关联日志。

### 3. 失败怎么分类？

失败至少分为：

- 用户输入错误。
- 外部依赖失败。
- 超时。
- 权限或路径不可访问。
- 数据写入失败。
- 任务被取消。
- 内部状态不一致。

不同失败要记录 `reason`，不要只写 `failed`。

### 4. 哪些字段可以安全记录？

模块设计时应列出允许进入生产日志的字段。

示例：

```txt
Allowed: jobId, imageId, count, bytes, width, height, status, reason
Debug only: absolutePath, originalUrl
Forbidden: prompt, imageDataUrl, token, fileContent
```

### 5. 是否需要耗时？

跨边界、外部资源、长任务阶段建议记录耗时。

适合记录 `durationMs` 的场景：

- IPC handler。
- 数据库初始化。
- 文件导入。
- 外部命令执行。
- 网络或协议请求。
- 任务恢复扫描。

## 标准日志点

### 应用生命周期

建议日志点：

- app lifecycle start。
- app ready。
- app activate。
- app quit requested。
- all windows closed。
- controllers registered。
- protocol registered。
- uncaught exception。
- unhandled rejection。

级别：

- 正常节点用 `info`。
- 异常但可恢复用 `warn`。
- 启动失败和未捕获异常用 `error`。

### 窗口管理

建议日志点：

- window create requested。
- window created。
- renderer load started。
- renderer load finished。
- renderer load failed。
- window closed。
- renderer process gone。
- maximize/unmaximize/fullscreen 等状态变化。

级别：

- 正常状态变化用 `info`。
- 找不到窗口、重复创建、异常重建用 `warn`。
- 加载失败、进程崩溃用 `error`。

### IPC

建议日志点：

- handler registered。
- duplicate handler ignored。
- handler completed。
- handler failed。

字段：

- `channel`
- `sender`
- `durationMs`
- `error`

级别：

- completed 用 `info`。
- failed 用 `error`。
- duplicate ignored 用 `warn`。

### 用户动作

建议日志点：

- action requested。
- action accepted。
- action ignored with reason。
- action completed。
- action failed。

字段：

- `sender`
- `action`
- `jobId`，如果有。
- 安全摘要字段。

级别：

- requested/accepted/completed 用 `info`。
- ignored/fallback 用 `warn`。
- failed 用 `error`。

### 长任务

建议日志点：

- task created。
- task validated。
- task started。
- task progress milestone。
- task cancellation requested。
- task cancelled。
- task completed。
- task failed。
- task cleaned。

字段：

- `jobId`
- `status`
- `reason`
- `durationMs`
- `owner`
- `pid`

级别：

- 主状态变化用 `info`。
- 可恢复异常和 fallback 用 `warn`。
- 任务失败用 `error`。
- 高频 progress 用 `debug`。

### 外部进程

建议日志点：

- executable resolved。
- process spawn requested。
- process spawned。
- first valid output received。
- process timeout。
- process closed。
- process error。
- process killed。

字段：

- `pid`
- `commandName`
- `durationMs`
- `exitCode`
- `signal`
- `reason`

注意：

- 不记录完整命令参数中的用户 prompt。
- 不记录完整 stdout/stderr，最多记录受限 tail，并确认不含敏感内容。

### 文件系统

建议日志点：

- file operation requested。
- target directory ensured。
- import/move/copy completed。
- fallback path used。
- cleanup completed。
- cleanup skipped。
- cleanup failed。

字段：

- `jobId`
- `imageId`
- `basename`
- `bytes`
- `width`
- `height`
- `reason`

注意：

- 生产 `info/warn/error` 默认不写完整绝对路径。
- 需要定位路径时，用 `basename`、`pathHash` 或 `debug/verbose`。

### 数据库

建议日志点：

- database open started/completed。
- schema ensured。
- migration applied。
- transaction failed。
- database closed。

字段：

- `table`
- `migration`
- `durationMs`
- `rowCount`
- `reason`

注意：

- 不记录 SQL 参数中的用户内容。
- 不 dump 完整 row。

### Custom Protocol

建议日志点：

- scheme registered。
- handler registered。
- request rejected。
- registry missed。
- registered resource blocked。
- resource served。

级别：

- 注册用 `info`。
- rejected/missed/blocked 用 `warn`。
- 高频 serve 用 `debug`。

## 日志字段命名

使用稳定、短小、可搜索的 key。

推荐：

- `jobId`
- `imageId`
- `channel`
- `sender`
- `owner`
- `pid`
- `durationMs`
- `status`
- `reason`
- `count`
- `bytes`
- `width`
- `height`
- `basename`
- `pathHash`
- `eventType`

避免：

- 同一含义使用多个名字，例如 `webContentsId`、`senderId`、`sender` 混用。
- 使用模糊字段，例如 `data`、`payload`、`result`。
- 把对象直接拼进日志。

## 日志消息格式

统一使用稳定英文消息和 key-value 摘要。

推荐：

```ts
logger.info(
  'image import completed: jobId=%s imageId=%s index=%d bytes=%d width=%s height=%s',
  jobId,
  imageId,
  index,
  bytes,
  String(width ?? 'unknown'),
  String(height ?? 'unknown'),
)
```

错误示例：

```ts
logger.error(
  'image import failed: jobId=%s reason=%s error=%s',
  jobId,
  reason,
  error instanceof Error ? error.message : String(error),
)
```

原则：

- 每条日志只表达一个事件。
- message 文案保持稳定，方便搜索。
- 字段顺序尽量固定：标识符 -> 状态 -> 数量/耗时 -> 原因。
- 错误统一转成 message。
- 不序列化未知大对象。

## 隐私和安全

### 禁止进入生产日志

- prompt 原文。
- 图片 base64。
- 文件内容。
- token、API key、cookie。
- 用户认证输出原文。
- 完整 URL query。
- 未脱敏的完整本地路径。

### 谨慎进入 debug/verbose

- 绝对路径。
- 原始 URL。
- stdout/stderr tail。
- 用户可识别文件名。

### 推荐替代字段

- `promptLength` 代替 prompt。
- `references` 代替参考图列表。
- `basename` 或 `pathHash` 代替绝对路径。
- `bytes`、`width`、`height` 代替图片内容。
- `reason` 代替完整外部输出。

## 审查清单

新增或修改模块时，review 日志需要检查：

- 是否覆盖了模块边界？
- 是否覆盖了主状态变化？
- 是否覆盖了失败、取消、恢复路径？
- 长任务日志是否有稳定关联字段？
- 生产级别日志是否避免敏感信息？
- 高频日志是否使用 `debug`？
- `warn` 是否只用于可恢复异常？
- `error` 是否代表当前操作确实失败？
- 日志是否会让生产文件过度膨胀？
- 日志文案和字段名是否稳定？

## 模块日志设计模板

新模块设计时可以按下面模板补一小段设计说明。

```md
### Module: <module-name>

Boundary:
- IPC:
- File system:
- Database:
- External process:
- System API:

Correlation:
- Primary id:
- Secondary ids:

State machine:
- requested
- validated
- started
- completed
- failed

Info logs:
- <event>

Warn logs:
- <recoverable event>

Error logs:
- <failure event>

Debug logs:
- <high-frequency or diagnostic event>

Production-safe fields:
- <field>

Debug-only fields:
- <field>

Forbidden fields:
- <field>
```

## 最小落地要求

每个新功能至少满足：

1. IPC 或入口处能看到用户动作摘要。
2. service 主流程能看到关键状态变化。
3. 失败路径有 `error` 或明确的错误事件。
4. 可恢复异常有 `warn` 和 `reason`。
5. 长任务有稳定 id 串联全链路。
6. 生产日志不包含敏感内容。

满足这些要求后，再根据真实排查需要补充 `debug` 或 `verbose`。
