DROP INDEX IF EXISTS idx_bookmarks_mark_url;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookmarks_mark_url_category
  ON bookmarks(mark, url, category);
