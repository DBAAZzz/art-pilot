CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS generation_tasks (
  id TEXT PRIMARY KEY,
  codex_thread_id TEXT,
  prompt TEXT NOT NULL,
  count INTEGER NOT NULL,
  aspect_ratio TEXT,
  size TEXT,
  generation_params TEXT,
  references_json TEXT,
  status TEXT NOT NULL,
  error TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS generated_images (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  image_index INTEGER NOT NULL,
  original_codex_path TEXT,
  library_path TEXT NOT NULL,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  favorite INTEGER NOT NULL DEFAULT 0,
  cleanup_status TEXT NOT NULL DEFAULT 'pending',
  cleanup_error TEXT,
  created_at INTEGER NOT NULL,
  moved_at INTEGER NOT NULL,
  FOREIGN KEY(task_id) REFERENCES generation_tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_created_at
  ON generation_tasks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_images_task_id_index
  ON generated_images(task_id, image_index);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  description TEXT,
  source_site TEXT NOT NULL,
  source_url TEXT,
  source_author TEXT,
  original_source_url TEXT,
  original_language TEXT,
  categories_json TEXT NOT NULL DEFAULT '[]',
  variables_json TEXT NOT NULL DEFAULT '[]',
  preview_images_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_prompts_updated_at
  ON prompts(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompts_source_url
  ON prompts(source_url)
  WHERE source_url IS NOT NULL;
