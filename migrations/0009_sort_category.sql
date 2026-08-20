-- Per-group sort profiles + per-group sticky sort.
--
-- Rebuild sort_profiles to scope name uniqueness per (mark, category, name).
-- D1 keeps foreign_keys ON and ignores PRAGMA foreign_keys = OFF, so we drop
-- sort_profile_items (no inbound FKs) BEFORE dropping sort_profiles, which
-- prevents the DROP from cascading the items away.

-- 1. Back up items so the profile rebuild cannot lose them.
CREATE TABLE sort_profile_items_bak AS SELECT * FROM sort_profile_items;

-- 2. Rebuild sort_profiles with a per-group category + scoped unique name.
CREATE TABLE sort_profiles_new (
  id TEXT PRIMARY KEY NOT NULL,
  mark TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (mark) REFERENCES collections(mark) ON DELETE CASCADE,
  UNIQUE (mark, category, name)
);

-- Backfill category from each profile's most common item category (else 'default').
INSERT INTO sort_profiles_new (id, mark, category, name, created_at, updated_at)
  SELECT sp.id, sp.mark,
    COALESCE(
      (SELECT s.category FROM sort_profile_items s
       WHERE s.profile_id = sp.id
       GROUP BY s.category ORDER BY COUNT(*) DESC LIMIT 1),
      'default'
    ),
    sp.name, sp.created_at, sp.updated_at
  FROM sort_profiles sp;

-- 3. Drop old tables safely (items first — nothing references them).
DROP TABLE sort_profile_items;
DROP TABLE sort_profiles;
ALTER TABLE sort_profiles_new RENAME TO sort_profiles;

-- 4. Recreate items with the same shape/FKs and restore data.
CREATE TABLE sort_profile_items (
  profile_id TEXT NOT NULL,
  mark TEXT NOT NULL,
  category TEXT NOT NULL,
  uuid TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY (profile_id, uuid),
  FOREIGN KEY (profile_id) REFERENCES sort_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (mark) REFERENCES collections(mark) ON DELETE CASCADE
);

INSERT INTO sort_profile_items (profile_id, mark, category, uuid, sort_order)
  SELECT profile_id, mark, category, uuid, sort_order FROM sort_profile_items_bak;

DROP TABLE sort_profile_items_bak;

CREATE INDEX IF NOT EXISTS idx_sort_profile_items_profile ON sort_profile_items(profile_id, category, sort_order);

-- 5. Per-group remembered sort: value is a fixed sort key or a sort profile id.
CREATE TABLE IF NOT EXISTS category_sorts (
  mark TEXT NOT NULL,
  category TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (mark, category),
  FOREIGN KEY (mark) REFERENCES collections(mark) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_category_sorts_mark ON category_sorts(mark);
