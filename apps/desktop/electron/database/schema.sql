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
  size TEXT,
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
