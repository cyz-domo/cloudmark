-- Cloudmark D1 schema

CREATE TABLE IF NOT EXISTS collections (
  mark TEXT PRIMARY KEY NOT NULL,
  write_token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  migrated_from_kv INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookmarks (
  uuid TEXT PRIMARY KEY NOT NULL,
  mark TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'default',
  favicon TEXT,
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  FOREIGN KEY (mark) REFERENCES collections(mark) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_mark ON bookmarks(mark);
CREATE INDEX IF NOT EXISTS idx_bookmarks_mark_category ON bookmarks(mark, category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_mark_url ON bookmarks(mark, url);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start INTEGER NOT NULL
);
