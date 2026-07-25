-- Per-collection preferences (bookmarklet + visibility)
ALTER TABLE collections ADD COLUMN redirect_after_save INTEGER NOT NULL DEFAULT 1;
ALTER TABLE collections ADD COLUMN default_category TEXT NOT NULL DEFAULT 'default';
ALTER TABLE collections ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1;
