# ArtPilot 技术栈与方案

## 产品定位

本地 Codex 生图工作台 + 素材归档管理工具。用户通过 ChatGPT 账号 OAuth 认证，使用 Codex 内置的 Image Gen 能力批量生成图片，结合 Eagle MCP 实现自动归档、prompt 注释和素材管理。

目标用户：个人创作者、小团队，追求本地优先、低门槛、深度自动化。

---

## 已有项目结构

```
art-pilot/                          # pnpm monorepo
├── apps/
│   └── desktop/                    # Electron 桌面客户端
│       ├── electron/               # Main process
│       │   ├── main.ts
│       │   ├── preload.ts
│       │   ├── core/               # 生命周期、窗口管理
│       │   ├── controllers/        # IPC 入口
│       │   ├── services/           # 业务逻辑
│       │   └── api/                # API 封装
│       └── src/                    # Renderer process (React)
├── packages/
│   └── shared/                     # 跨进程共享类型和常量
├── pnpm-workspace.yaml
└── package.json
```

---

## 技术栈选型

### 已确定（项目中已有）

| 层级 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 运行时 | Electron | ^41.3.0 | 桌面客户端容器 |
| UI 框架 | React | ^19.1.0 | Renderer 进程 |
| 构建工具 | Vite | ^6.3.3 | + vite-plugin-electron |
| 语言 | TypeScript | ^5.8.3 | 全栈类型安全 |
| 包管理 | pnpm | ^10.33.0 | Monorepo workspace |
| 打包 | electron-builder | ^25.1.8 | 桌面应用打包 |

### 待引入

| 层级 | 技术 | 用途 |
|------|------|------|
| **UI 组件** | Tailwind CSS + shadcn/ui | 快速构建界面，组件可定制 |
| **路由** | React Router v7 | 页面导航（图库/设置/任务详情） |
| **状态管理** | Zustand | 轻量级，适合 Electron 单页应用 |
| **数据请求** | TanStack Query | 管理任务轮询、图库列表状态 |
| **本地数据库** | better-sqlite3 + Drizzle ORM | 任务、资产、prompt 历史、额度流水 |
| **图片处理** | sharp | 缩略图生成、格式转换、压缩 |
| **图片元信息** | image-size / exifr | 读取尺寸、格式、EXIF |
| **文件监听** | chokidar | 监听 Codex 生成目录 |
| **本地设置** | electron-store | 用户偏好、路径配置 |
| **日志** | pino | 结构化日志，调试和审计 |
| **凭证存储** | keytar | 安全存储 OAuth token |
| **进程通信** | child_process | 调用 Codex CLI |

---

## 核心模块设计

### 1. 认证模块（Auth）

- Electron 内嵌 OAuth flow，用户用 ChatGPT 账号登录
- token 存本地 keychain（keytar），自动刷新
- 不接管/不复制 Codex CLI 自身的 credentials
- 登录状态持久化，启动时检查 token 有效性

```
electron/services/authService.ts
├── openOAuthWindow()        # 打开 OAuth 授权窗口
├── exchangeCodeForToken()   # 换取 access_token
├── refreshToken()           # 自动刷新
├── getToken()               # 安全读取
└── logout()                 # 清除凭证
```

### 2. 生图引擎（Generation）

- 通过 Codex SDK 或 child_process 调用 Codex CLI
- 支持 Codex 内置的 Image Gen（imagegen skill）
- 并发控制：本地并发池，默认 3-5 个并行任务
- 任务参数：prompt、model、size、quality、数量、输出目录

```
electron/services/generationService.ts
├── createJob(params)        # 创建生图任务
├── executeJob(jobId)        # 执行单个任务
├── cancelJob(jobId)         # 取消任务
├── batchCreate(prompts[])   # 批量创建
└── getConcurrencyPool()     # 并发池管理
```

**任务状态机：**

```
queued → running → succeeded → imported
                 → failed → retry → running
                          → canceled
```

### 3. 本地数据库（Database）

SQLite + Drizzle ORM，存储所有结构化数据。

**核心表设计：**

```sql
-- 生成任务
CREATE TABLE jobs (
    id           TEXT PRIMARY KEY,
    prompt       TEXT NOT NULL,
    model        TEXT DEFAULT 'gpt-image',
    size         TEXT DEFAULT '1024x1024',
    quality      TEXT DEFAULT 'hd',
    quantity     INTEGER DEFAULT 1,
    status       TEXT DEFAULT 'queued',      -- queued/running/succeeded/failed/canceled
    output_dir   TEXT,
    error_msg    TEXT,
    created_at   INTEGER NOT NULL,
    started_at   INTEGER,
    finished_at  INTEGER
);

-- 图片资产
CREATE TABLE assets (
    id             TEXT PRIMARY KEY,
    job_id         TEXT REFERENCES jobs(id),
    file_path      TEXT NOT NULL,             -- 本地绝对路径
    thumb_path     TEXT,                      -- 缩略图路径
    file_name      TEXT NOT NULL,
    format         TEXT,                      -- png/webp/jpg
    width          INTEGER,
    height         INTEGER,
    file_size      INTEGER,                   -- 字节
    prompt         TEXT,
    revised_prompt TEXT,
    is_favorite    INTEGER DEFAULT 0,
    eagle_item_id  TEXT,                      -- Eagle 归档后的 ID
    collection_id  TEXT REFERENCES collections(id),
    created_at     INTEGER NOT NULL
);

-- 项目分组
CREATE TABLE collections (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  INTEGER NOT NULL
);

-- Prompt 模板
CREATE TABLE prompt_templates (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    prompt      TEXT NOT NULL,
    tags        TEXT,                         -- JSON 数组
    use_count   INTEGER DEFAULT 0,
    created_at  INTEGER NOT NULL
);

-- 操作日志
CREATE TABLE audit_logs (
    id          TEXT PRIMARY KEY,
    action      TEXT NOT NULL,                -- generate/import/delete/export
    entity_type TEXT,                         -- job/asset/collection
    entity_id   TEXT,
    detail      TEXT,                         -- JSON
    created_at  INTEGER NOT NULL
);
```

```
electron/services/databaseService.ts
├── initDatabase()           # 初始化/迁移
├── jobs.*                   # 任务 CRUD
├── assets.*                 # 资产 CRUD
├── collections.*            # 分组 CRUD
├── promptTemplates.*        # 模板 CRUD
└── auditLogs.*              # 日志写入/查询
```

### 4. 资产管理（Assets）

- 图片按 `~/Pictures/ArtPilot/{date}/{jobId}/` 存放
- 缩略图按 `~/Pictures/ArtPilot/thumbs/{assetId}.webp` 存放
- 支持收藏、分组、搜索（SQLite FTS5 全文搜索 prompt）
- 支持导出、批量操作

```
electron/services/assetService.ts
├── importFromJob(jobId)     # 从完成的任务导入资产
├── generateThumbnail(path)  # sharp 生成缩略图
├── readMetadata(path)       # 读取图片元信息
├── toggleFavorite(assetId)  # 收藏/取消收藏
├── moveToCollection(ids, collectionId)
├── searchByPrompt(query)    # FTS5 搜索
└── deleteAssets(ids)        # 删除资产
```

### 5. Eagle 集成（Eagle MCP）

- 通过 Eagle MCP 协议与 Eagle App 通信
- 生成后自动归档到 Eagle
- prompt 写入 Eagle 注释字段
- 按日期/项目/标签分类

```
electron/services/eagleService.ts
├── checkConnection()        # 检测 Eagle 是否运行
├── importAsset(asset)       # 导入单张图到 Eagle
├── batchImport(assets[])    # 批量导入
├── addTags(itemId, tags[])  # 添加标签
└── setAnnotation(itemId, text)  # 写入注释
```

**归档 Hook 流程：**

```
任务完成 → 资产导入本地库 → 触发 Eagle Hook → 调用 Eagle MCP 导入
                                            → 写入 prompt 注释
                                            → 添加日期/项目标签
                                            → 回写 eagle_item_id 到 SQLite
```

### 6. 文件监听（File Watcher）

- chokidar 监听 Codex 生成目录
- 新文件 hash 去重，防止重复导入
- 等待文件写入稳定后再处理（防半截文件）
- 关联 prompt 和输出文件

```
electron/services/watcherService.ts
├── startWatching(dir)       # 开始监听目录
├── stopWatching()           # 停止监听
├── onFileReady(callback)    # 文件稳定后回调
└── matchJobToFile(file)     # 关联任务和文件
```

### 7. Hook 系统（Hooks）

- 可配置的事件钩子
- 内置 Hook：Eagle 归档、缩略图生成、通知
- 用户可自定义 Shell Hook

```
electron/services/hookService.ts
├── registerHook(event, handler)
├── triggerHook(event, data)
└── 内置事件:
    ├── job:completed         # 任务完成
    ├── asset:imported        # 资产导入
    ├── asset:eagle_archived  # Eagle 归档完成
    └── job:failed            # 任务失败
```

---

## Renderer 页面结构

```
src/
├── main.tsx                 # 入口
├── App.tsx                  # 根组件 + 路由
├── pages/
│   ├── Home/                # 首页（Prompt 输入 + 队列 + 图库）
│   ├── Gallery/             # 图库详情页
│   ├── Collections/         # 项目分组管理
│   ├── Templates/           # Prompt 模板库
│   └── Settings/            # 设置页
├── components/
│   ├── layout/              # 侧边栏、顶栏、状态栏
│   ├── prompt/              # Prompt 输入框、参数面板
│   ├── queue/               # 任务队列列表
│   ├── gallery/             # 图片网格、图片卡片
│   └── common/              # 通用组件
├── stores/                  # Zustand stores
│   ├── jobStore.ts
│   ├── assetStore.ts
│   └── settingsStore.ts
├── hooks/                   # 自定义 React hooks
├── types/                   # 类型定义
└── utils/                   # 工具函数
```

---

## IPC 通道扩展（packages/shared）

```typescript
export const IPC_CHANNELS = {
    file: { readOneTextFile: 'file:readOneTextFile' },

    // 新增
    auth: {
        login: 'auth:login',
        logout: 'auth:logout',
        getStatus: 'auth:getStatus',
    },
    job: {
        create: 'job:create',
        batchCreate: 'job:batchCreate',
        cancel: 'job:cancel',
        getList: 'job:getList',
        getDetail: 'job:getDetail',
    },
    asset: {
        getList: 'asset:getList',
        getDetail: 'asset:getDetail',
        toggleFavorite: 'asset:toggleFavorite',
        delete: 'asset:delete',
        search: 'asset:search',
        moveToCollection: 'asset:moveToCollection',
    },
    collection: {
        create: 'collection:create',
        getList: 'collection:getList',
        delete: 'collection:delete',
    },
    eagle: {
        checkConnection: 'eagle:checkConnection',
        importAsset: 'eagle:importAsset',
        batchImport: 'eagle:batchImport',
    },
    settings: {
        get: 'settings:get',
        set: 'settings:set',
    },
} as const;
```

---

## 核心流程

### 单次生图

```
用户输入 Prompt + 设置参数
  → Renderer: 调用 window.api.job.create()
  → Main: JobController → GenerationService.createJob()
  → 写入 SQLite (status=queued)
  → 并发池调度 → 调用 Codex imagegen
  → Codex 生成图片到指定目录
  → WatcherService 检测新文件
  → AssetService.importFromJob() → 生成缩略图 → 写 SQLite
  → HookService.trigger('asset:imported')
  → EagleService.importAsset() (如果开启)
  → Renderer: TanStack Query 轮询更新 UI
```

### 批量生图

```
用户输入多个 Prompt 或使用模板
  → 批量创建 jobs (status=queued)
  → 并发池逐个调度 (max 3-5 并行)
  → 每完成一个 → 导入资产 → 触发 Hook
  → UI 实时显示队列进度
  → 全部完成后发送系统通知
```

### 断点恢复

```
应用启动
  → DatabaseService.getJobsByStatus('running')
  → 扫描对应 output_dir 是否已有图片文件
  → 已有文件 → 标记 succeeded → 导入资产
  → 无文件 → 重置为 queued → 重新调度
```

---

## 注意事项

### Codex 速率限制
- 批量生图要做限流，并发不超过 3-5 个
- 遇到 429 做指数退避重试（1s/2s/4s，最多 3 次）
- 区分可重试错误（429、5xx）和不可重试错误（参数错误、内容审核拒绝）

### OAuth Token 管理
- token 存 keytar，不存明文文件
- 启动时检查 token 有效性，过期自动刷新
- 刷新失败引导用户重新登录

### Prompt-图片关联
- 生成时由 App 统一管理 jobId → prompt 映射
- 输出目录按 jobId 隔离，避免混淆
- 如果 Codex 输出有 sidecar metadata，优先读取

### 文件监听稳定性
- chokidar 监听新文件后，等 500ms 确认文件写入完成
- 用文件 hash 去重，防止重复导入
- 处理文件权限、路径编码等跨平台差异

### 内容审核
- OpenAI 自带内容过滤，被拒绝的任务标记为 rejected
- rejected 任务不扣额度，记录 prompt 供审查

### MVP 建议
- 先只做 macOS
- 先用轮询而非 SSE/WebSocket
- Eagle 集成作为可选 Hook，不强依赖
- 批量生成先限制单次 50 张以内

---

## 依赖安装参考

### apps/desktop 新增依赖

```bash
# 生产依赖
pnpm --filter @art-pilot/desktop add \
    zustand \
    @tanstack/react-query \
    react-router \
    better-sqlite3 \
    drizzle-orm \
    sharp \
    chokidar \
    electron-store \
    keytar \
    pino \
    image-size

# 开发依赖
pnpm --filter @art-pilot/desktop add -D \
    tailwindcss \
    @tailwindcss/vite \
    drizzle-kit \
    @types/better-sqlite3
```

---

## 替代方案对比

| 维度 | 方案 A: Cloudflare Web | 方案 B: Electron + Codex（当前选择） |
|------|------------------------|--------------------------------------|
| 部署 | 需要域名/Worker | 安装即用 |
| 认证 | 自建邮箱白名单 | ChatGPT OAuth |
| 费用 | 自己承担 API 费用 | 用户自己的订阅额度 |
| 多用户 | 天然支持 | 单用户，团队需额外设计 |
| 图片存储 | R2 云端 | 本地文件系统 |
| 素材管理 | 需要自建图库 | 直接对接 Eagle |
| 离线 | 不支持 | 除生图外可离线 |
| 自动化 | Worker + Queue | Codex + Hook + MCP |
| 适合场景 | 多人团队 Web 工作台 | 个人/小团队本地创作工具 |
