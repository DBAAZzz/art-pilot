# 桌面端数据库

Art Pilot 桌面端使用 SQLite 存储本地数据，数据库文件名为 `art-pilot.sqlite`，运行时路径位于 Electron 的 `app.getPath('userData')` 目录下。

可执行的数据库结构定义在 `schema.sql` 中。`DatabaseService` 会把该 SQL 文件作为文本打包，并在应用启动时执行，所以 `schema.sql` 是开发、评审和工具查看数据库结构的主要来源。

## 运行时约定

- 数据库驱动使用 `better-sqlite3`。
- 数据库连接由 `apps/desktop/electron/services/databaseService.ts` 管理。
- 启动时会启用 `journal_mode = WAL`，提升桌面应用读写稳定性。
- 启动时会启用 `foreign_keys = ON`，保证图片记录归属于生成任务。
- 时间字段统一使用毫秒级 Unix 时间戳，也就是 `Date.now()` 的返回值。
- Renderer 不能直接访问数据库，必须通过 preload 暴露的 IPC API 调用 main process 服务。

## 迁移方式

当前迁移采用轻量幂等策略：

1. `DatabaseService` 启动时执行 `schema.sql`。
2. `CREATE TABLE IF NOT EXISTS` 和 `CREATE INDEX IF NOT EXISTS` 保证重复执行安全。
3. 对已有用户数据库新增字段时，在 `DatabaseService.runMigrations()` 中通过 `ensureColumn(...)` 补列。

已有补列迁移：

| 表 | 字段 | 定义 |
| --- | --- | --- |
| `generation_tasks` | `references_json` | `TEXT` |
| `generation_tasks` | `aspect_ratio` | `TEXT` |
| `generation_tasks` | `generation_params` | `TEXT` |
| `generated_images` | `favorite` | `INTEGER NOT NULL DEFAULT 0` |

新增表、索引或字段时，需要同步更新：

- `apps/desktop/electron/database/schema.sql`
- `apps/desktop/electron/services/databaseService.ts`
- 本 README
- 对应 service 中的行类型和读写 SQL

## 数据表

### `settings`

桌面端偏好设置的键值表。

| 字段 | 类型 | 可为空 | 说明 |
| --- | --- | --- | --- |
| `key` | `TEXT` | 否 | 设置项标识。主键。 |
| `value` | `TEXT` | 否 | 序列化后的设置值。 |
| `updated_at` | `INTEGER` | 否 | 最后更新时间，毫秒级 Unix 时间戳。 |

已知设置项：

| Key | 说明 |
| --- | --- |
| `imageLibraryPath` | 导入后的生成图片存储目录，使用绝对路径。默认位于系统 Pictures 下的 `Art Pilot` 目录。 |
| `codexImageCleanup` | Codex 生成图片的清理策略。当前取值：`after-import`、`never`。 |
| `codexSessionCleanup` | 预留的会话清理策略。当前运行时固定返回 `never`。 |

主要使用方：

- `SettingsService`
- `CodexCleanupService`
- 图片库路径相关功能

### `generation_tasks`

每次图片生成任务对应一条记录。任务记录保存用户输入、Codex 线程、生成参数、参考图和终态信息。

| 字段 | 类型 | 可为空 | 说明 |
| --- | --- | --- | --- |
| `id` | `TEXT` | 否 | Art Pilot 内部任务 id。主键。 |
| `codex_thread_id` | `TEXT` | 是 | 生成开始后绑定的 Codex thread id。 |
| `prompt` | `TEXT` | 否 | 用户提交的生成提示词。 |
| `count` | `INTEGER` | 否 | 请求生成的图片数量。 |
| `aspect_ratio` | `TEXT` | 是 | 用户在界面选择的画面比例，用于历史记录和资产详情恢复展示。 |
| `size` | `TEXT` | 是 | 请求的图片尺寸；为空表示使用服务默认值。 |
| `generation_params` | `TEXT` | 是 | 生成参数 JSON，面向资产详情页展示和后续扩展。 |
| `references_json` | `TEXT` | 是 | 参考图 JSON 数组；无参考图时写入 `NULL`。 |
| `status` | `TEXT` | 否 | 任务状态。当前取值：`running`、`complete`、`error`、`cancelled`。 |
| `error` | `TEXT` | 是 | 错误或取消原因。 |
| `created_at` | `INTEGER` | 否 | 任务创建时间，毫秒级 Unix 时间戳。 |
| `completed_at` | `INTEGER` | 是 | 任务进入终态的时间，毫秒级 Unix 时间戳。 |

`generation_params` 当前结构：

```json
{
  "provider": "codex",
  "model": null,
  "checkpoint": null,
  "size": "auto",
  "aspectRatio": "1:1",
  "seed": null,
  "steps": null,
  "sampler": null,
  "cfgScale": null,
  "count": 1,
  "referenceCount": 0
}
```

`references_json` 当前保存本地参考图信息：

```json
[
  {
    "id": "reference-id",
    "kind": "local-file",
    "path": "/absolute/path/to/image.png",
    "name": "image.png",
    "mimeType": "image/png"
  }
]
```

索引：

| 索引 | 字段 | 用途 |
| --- | --- | --- |
| `idx_generation_tasks_created_at` | `created_at DESC` | 加速最近历史记录查询。 |

主要使用方：

- `ImageHistoryService`
- `AssetService`

### `generated_images`

已导入图片库的生成图片记录。图片文件本身存储在图片库目录，数据库只保存路径和元信息。

| 字段 | 类型 | 可为空 | 说明 |
| --- | --- | --- | --- |
| `id` | `TEXT` | 否 | 图片 id。主键。 |
| `task_id` | `TEXT` | 否 | 所属的 `generation_tasks.id`。 |
| `image_index` | `INTEGER` | 否 | 图片在本次生成结果中的序号，从 1 开始。 |
| `original_codex_path` | `TEXT` | 是 | 导入前的 Codex 原始生成文件路径。 |
| `library_path` | `TEXT` | 否 | 图片导入到图片库后的绝对路径。 |
| `file_size` | `INTEGER` | 是 | 导入后文件大小，单位为字节。 |
| `width` | `INTEGER` | 是 | 图片宽度，单位为像素。 |
| `height` | `INTEGER` | 是 | 图片高度，单位为像素。 |
| `favorite` | `INTEGER` | 否 | 收藏状态。`1` 表示已收藏，`0` 表示未收藏。 |
| `cleanup_status` | `TEXT` | 否 | Codex 原图清理状态。当前取值：`pending`、`skipped`、`complete`、`failed`。 |
| `cleanup_error` | `TEXT` | 是 | 清理失败原因。 |
| `created_at` | `INTEGER` | 否 | 写入历史记录时的毫秒级 Unix 时间戳。 |
| `moved_at` | `INTEGER` | 否 | 文件导入完成时的毫秒级 Unix 时间戳。 |

外键：

| 字段 | 引用 |
| --- | --- |
| `task_id` | `generation_tasks(id)` |

索引：

| 索引 | 字段 | 用途 |
| --- | --- | --- |
| `idx_generated_images_task_id_index` | `task_id`, `image_index` | 加速按任务读取图片并保持结果顺序。 |

主要使用方：

- `ImageHistoryService`
- `AssetService`
- `CodexCleanupService`
- `generatedImageRegistry`

### `prompts`

提示词管理表。用于保存手动创建或从外部来源导入的提示词。

| 字段 | 类型 | 可为空 | 说明 |
| --- | --- | --- | --- |
| `id` | `TEXT` | 否 | 提示词 id。主键。 |
| `title` | `TEXT` | 否 | 提示词标题。 |
| `content` | `TEXT` | 否 | 提示词正文。 |
| `description` | `TEXT` | 是 | 提示词说明。 |
| `source_site` | `TEXT` | 否 | 来源站点。当前取值：`manual`、`youmind`。 |
| `source_url` | `TEXT` | 是 | 来源链接。存在时用于去重更新。 |
| `source_author` | `TEXT` | 是 | 来源作者。 |
| `original_source_url` | `TEXT` | 是 | 原始来源链接。 |
| `original_language` | `TEXT` | 是 | 原始语言。 |
| `categories_json` | `TEXT` | 否 | 分类 JSON 数组，默认值为 `[]`。 |
| `preview_images_json` | `TEXT` | 否 | 预览图 JSON 数组，默认值为 `[]`。 |
| `created_at` | `INTEGER` | 否 | 创建时间，毫秒级 Unix 时间戳。 |
| `updated_at` | `INTEGER` | 否 | 更新时间，毫秒级 Unix 时间戳。 |

`preview_images_json` 当前结构：

```json
[
  {
    "url": "https://example.com/preview.png",
    "alt": "preview image"
  }
]
```

索引：

| 索引 | 字段 | 用途 |
| --- | --- | --- |
| `idx_prompts_updated_at` | `updated_at DESC` | 加速提示词列表按更新时间倒序读取。 |
| `idx_prompts_source_url` | `source_url` | 对非空来源链接做唯一约束，避免重复导入同一来源。 |

主要使用方：

- `PromptService`
- `PromptImportService`

## 维护注意事项

- 修改数据库结构时，先改 `schema.sql`，再补迁移和 README。
- 不要在 renderer 中直接读取 SQLite 或 Node.js 文件路径。
- 新增跨进程数据类型时，优先放在 `packages/shared` 中。
- JSON 字段写入前应只保存可持久化数据，不保存临时的 `imageUrl` 或 renderer-only 状态。
- 路径字段当前保存绝对路径，展示图片时应通过主进程受控协议转换成安全 URL。
