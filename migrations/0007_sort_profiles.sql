ALTER TABLE collections ADD COLUMN home_sort_profile TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS sort_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  mark TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mark) REFERENCES collections(mark) ON DELETE CASCADE,
  UNIQUE (mark, name)
);

CREATE TABLE IF NOT EXISTS sort_profile_items (
  profile_id TEXT NOT NULL,
  mark TEXT NOT NULL,
  category TEXT NOT NULL,
  uuid TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (profile_id, uuid),
  FOREIGN KEY (profile_id) REFERENCES sort_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (mark) REFERENCES collections(mark) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sort_profile_items_profile ON sort_profile_items(profile_id, category, sort_order);
