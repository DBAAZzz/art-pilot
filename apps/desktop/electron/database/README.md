# 桌面端数据库

Art Pilot 的桌面端数据存储在 SQLite 数据库中，文件名为 `art-pilot.sqlite`，路径位于 Electron 的 `app.getPath('userData')` 目录下。

可执行的数据库结构定义在 `schema.sql` 中。`DatabaseService` 会把该 SQL 文件作为文本打包并在应用启动时执行，因此 `schema.sql` 是开发、评审和工具查看数据库结构的主要来源。

## 数据表

### `settings`

桌面端偏好设置的键值表。

| 字段 | 类型 | 可为空 | 说明 |
| --- | --- | --- | --- |
| `key` | `TEXT` | 否 | 设置项标识。主键。 |
| `value` | `TEXT` | 否 | 序列化后的设置值。 |
| `updated_at` | `INTEGER` | 否 | 毫秒级 Unix 时间戳。 |

已知设置项：

| Key | 说明 |
| --- | --- |
| `imageLibraryPath` | 导入后的生成图片存储目录，使用绝对路径。 |
| `codexImageCleanup` | Codex 生成图片的清理策略。当前取值：`after-import`、`never`。 |
| `codexSessionCleanup` | 预留的会话清理策略。 |

### `generation_tasks`

每次图片生成任务对应一条记录。

| 字段 | 类型 | 可为空 | 说明 |
| --- | --- | --- | --- |
| `id` | `TEXT` | 否 | 应用内任务 id。主键。 |
| `codex_thread_id` | `TEXT` | 是 | 生成开始后绑定的 Codex thread id。 |
| `prompt` | `TEXT` | 否 | 用户提交的生成提示词。 |
| `count` | `INTEGER` | 否 | 请求生成的图片数量。 |
| `size` | `TEXT` | 是 | 请求的图片尺寸；为空表示使用服务默认值。 |
| `status` | `TEXT` | 否 | 任务状态。当前取值：`running`、`complete`、`error`、`cancelled`。 |
| `error` | `TEXT` | 是 | 错误或取消原因。 |
| `created_at` | `INTEGER` | 否 | 毫秒级 Unix 时间戳。 |
| `completed_at` | `INTEGER` | 是 | 写入终态时的毫秒级 Unix 时间戳。 |

索引：

| 索引 | 字段 | 用途 |
| --- | --- | --- |
| `idx_generation_tasks_created_at` | `created_at DESC` | 加速最近历史记录查询。 |

### `generated_images`

已导入图片库的生成图片记录。

| 字段 | 类型 | 可为空 | 说明 |
| --- | --- | --- | --- |
| `id` | `TEXT` | 否 | 图片 id。主键。 |
| `task_id` | `TEXT` | 否 | 所属的 `generation_tasks.id`。 |
| `image_index` | `INTEGER` | 否 | 图片在本次生成结果中的序号。 |
| `original_codex_path` | `TEXT` | 是 | 导入前的 Codex 原始生成文件路径。 |
| `library_path` | `TEXT` | 否 | 图片导入到图片库后的路径。 |
| `file_size` | `INTEGER` | 是 | 导入后文件大小，单位为字节。 |
| `width` | `INTEGER` | 是 | 图片宽度，单位为像素。 |
| `height` | `INTEGER` | 是 | 图片高度，单位为像素。 |
| `cleanup_status` | `TEXT` | 否 | 清理状态。当前取值：`pending`、`skipped`、`complete`、`failed`。 |
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
