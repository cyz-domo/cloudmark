ALTER TABLE bookmarks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE collections ADD COLUMN background_url TEXT NOT NULL DEFAULT '';

UPDATE bookmarks
SET sort_order = rowid
WHERE sort_order = 0;
