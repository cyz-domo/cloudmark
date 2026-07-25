import type {
  BookmarkInstance,
  BookmarksData,
  CollectionSettings,
} from "./types";
import { DEFAULT_COLLECTION_SETTINGS, defaultCategory } from "./types";
import { MAX_BOOKMARKS_PER_MARK } from "./constants";

export interface CollectionRow {
  mark: string;
  write_token_hash: string;
  created_at: string;
  updated_at: string;
  migrated_from_kv: number;
  /** 0 = one-time plaintext token not yet delivered to a client */
  token_delivered: number;
  redirect_after_save: number;
  default_category: string;
  is_public: number;
  background_url: string;
  category_order: string;
}

export function rowToSettings(row: CollectionRow): CollectionSettings {
  return {
    redirectAfterSave: row.redirect_after_save !== 0,
    defaultCategory: row.default_category || DEFAULT_COLLECTION_SETTINGS.defaultCategory,
    isPublic: row.is_public !== 0,
    backgroundUrl: row.background_url || "",
  };
}

export interface BookmarkRow {
  uuid: string;
  mark: string;
  url: string;
  title: string;
  description: string | null;
  category: string;
  favicon: string | null;
  created_at: string;
  modified_at: string;
}

export function rowToBookmark(row: BookmarkRow): BookmarkInstance {
  return {
    uuid: row.uuid,
    url: row.url,
    title: row.title,
    description: row.description ?? undefined,
    category: row.category || defaultCategory,
    favicon: row.favicon ?? undefined,
    createdAt: row.created_at,
    modifiedAt: row.modified_at,
  };
}

export async function getCollection(
  db: D1Database,
  mark: string,
): Promise<CollectionRow | null> {
  const row = await db
    .prepare(
      `SELECT mark, write_token_hash, created_at, updated_at, migrated_from_kv,
              COALESCE(token_delivered, 1) as token_delivered,
              COALESCE(redirect_after_save, 1) as redirect_after_save,
              COALESCE(default_category, 'default') as default_category,
              COALESCE(is_public, 1) as is_public,
              COALESCE(background_url, '') as background_url
              ,COALESCE(category_order, '') as category_order
       FROM collections WHERE mark = ?`,
    )
    .bind(mark)
    .first<CollectionRow>();
  return row;
}

export function getCategoryOrder(row: CollectionRow): string[] {
  try {
    const parsed = JSON.parse(row.category_order || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export async function updateCategoryOrder(db: D1Database, mark: string, categories: string[]): Promise<void> {
  await db.prepare("UPDATE collections SET category_order = ?, updated_at = ? WHERE mark = ?")
    .bind(JSON.stringify(categories), new Date().toISOString(), mark).run();
}

export async function renameCategory(db: D1Database, mark: string, from: string, to: string, order: string[]): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE bookmarks SET category = ? WHERE mark = ? AND category = ?").bind(to, mark, from),
    db.prepare("UPDATE collections SET category_order = ?, default_category = CASE WHEN default_category = ? THEN ? ELSE default_category END, updated_at = ? WHERE mark = ?")
      .bind(JSON.stringify(order), from, to, now, mark),
  ]);
}

export async function deleteCategory(db: D1Database, mark: string, category: string, order: string[]): Promise<number> {
  const results = await db.batch([
    db.prepare("DELETE FROM bookmarks WHERE mark = ? AND category = ?").bind(mark, category),
    db.prepare("UPDATE collections SET category_order = ?, default_category = CASE WHEN default_category = ? THEN 'default' ELSE default_category END, updated_at = ? WHERE mark = ?")
      .bind(JSON.stringify(order), category, new Date().toISOString(), mark),
  ]);
  return results[0]?.meta.changes ?? 0;
}

export async function deleteBookmarks(db: D1Database, mark: string, uuids: string[]): Promise<number> {
  if (!uuids.length) return 0;
  const result = await db.batch(uuids.map((uuid) => db.prepare("DELETE FROM bookmarks WHERE mark = ? AND uuid = ?").bind(mark, uuid)));
  const deleted = result.reduce((sum, item) => sum + (item.meta.changes ?? 0), 0);
  if (deleted) await touchCollection(db, mark);
  return deleted;
}

export async function getBookmarksForMark(
  db: D1Database,
  mark: string,
): Promise<BookmarkInstance[]> {
  const { results } = await db
    .prepare(
      `SELECT uuid, mark, url, title, description, category, favicon, created_at, modified_at
       FROM bookmarks WHERE mark = ? ORDER BY category ASC, sort_order ASC, created_at ASC`,
    )
    .bind(mark)
    .all<BookmarkRow>();

  return (results ?? []).map(rowToBookmark);
}

export async function getBookmarksData(
  db: D1Database,
  mark: string,
): Promise<BookmarksData | null> {
  const collection = await getCollection(db, mark);
  if (!collection) {
    return null;
  }
  const bookmarks = await getBookmarksForMark(db, mark);
  return { mark, bookmarks };
}

export async function countBookmarks(
  db: D1Database,
  mark: string,
): Promise<number> {
  const row = await db
    .prepare("SELECT COUNT(*) as count FROM bookmarks WHERE mark = ?")
    .bind(mark)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function createCollection(
  db: D1Database,
  mark: string,
  writeTokenHash: string,
  options?: {
    migratedFromKv?: boolean;
    tokenDelivered?: boolean;
    settings?: Partial<CollectionSettings>;
  },
): Promise<void> {
  const now = new Date().toISOString();
  // Migrated collections default to token_delivered=0 so the first page open can issue once.
  const delivered =
    options?.tokenDelivered !== undefined
      ? options.tokenDelivered
        ? 1
        : 0
      : options?.migratedFromKv
        ? 0
        : 1;
  const settings = {
    ...DEFAULT_COLLECTION_SETTINGS,
    ...options?.settings,
  };
  await db
    .prepare(
      `INSERT INTO collections
        (mark, write_token_hash, created_at, updated_at, migrated_from_kv, token_delivered,
         redirect_after_save, default_category, is_public, background_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      mark,
      writeTokenHash,
      now,
      now,
      options?.migratedFromKv ? 1 : 0,
      delivered,
      settings.redirectAfterSave ? 1 : 0,
      settings.defaultCategory || defaultCategory,
      settings.isPublic ? 1 : 0,
      settings.backgroundUrl || "",
    )
    .run();
}

export async function updateCollectionSettings(
  db: D1Database,
  mark: string,
  settings: CollectionSettings,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE collections
       SET redirect_after_save = ?,
           default_category = ?,
           is_public = ?,
           background_url = ?,
           updated_at = ?
       WHERE mark = ?`,
    )
    .bind(
      settings.redirectAfterSave ? 1 : 0,
      settings.defaultCategory || defaultCategory,
      settings.isPublic ? 1 : 0,
      settings.backgroundUrl || "",
      now,
      mark,
    )
    .run();
}

export async function reorderBookmarks(
  db: D1Database,
  mark: string,
  category: string,
  uuids: string[],
): Promise<void> {
  const statements = uuids.map((uuid, index) =>
    db.prepare("UPDATE bookmarks SET sort_order = ? WHERE uuid = ? AND mark = ? AND category = ?")
      .bind(index, uuid, mark, category),
  );
  await db.batch(statements);
  await touchCollection(db, mark);
}

/** Issue a fresh write token and mark it undelivered (or delivered). */
export async function rotateCollectionToken(
  db: D1Database,
  mark: string,
  writeTokenHash: string,
  options?: { delivered?: boolean; clearMigratedFlag?: boolean },
): Promise<void> {
  const now = new Date().toISOString();
  const delivered = options?.delivered === false ? 0 : 1;
  if (options?.clearMigratedFlag) {
    await db
      .prepare(
        `UPDATE collections
         SET write_token_hash = ?, updated_at = ?, token_delivered = ?, migrated_from_kv = 0
         WHERE mark = ?`,
      )
      .bind(writeTokenHash, now, delivered, mark)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE collections
         SET write_token_hash = ?, updated_at = ?, token_delivered = ?
         WHERE mark = ?`,
      )
      .bind(writeTokenHash, now, delivered, mark)
      .run();
  }
}

export async function markTokenDelivered(
  db: D1Database,
  mark: string,
): Promise<void> {
  await db
    .prepare("UPDATE collections SET token_delivered = 1 WHERE mark = ?")
    .bind(mark)
    .run();
}

export async function updateCollectionToken(
  db: D1Database,
  mark: string,
  writeTokenHash: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE collections
       SET write_token_hash = ?, updated_at = ?, migrated_from_kv = 0, token_delivered = 1
       WHERE mark = ?`,
    )
    .bind(writeTokenHash, now, mark)
    .run();
}

export async function touchCollection(
  db: D1Database,
  mark: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare("UPDATE collections SET updated_at = ? WHERE mark = ?")
    .bind(now, mark)
    .run();
}

export async function insertBookmark(
  db: D1Database,
  mark: string,
  bookmark: BookmarkInstance,
): Promise<void> {
  const position = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM bookmarks WHERE mark = ? AND category = ?")
    .bind(mark, bookmark.category)
    .first<{ next_order: number }>();
  await db
    .prepare(
      `INSERT INTO bookmarks
        (uuid, mark, url, title, description, category, favicon, created_at, modified_at, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      bookmark.uuid,
      mark,
      bookmark.url,
      bookmark.title,
      bookmark.description ?? null,
      bookmark.category,
      bookmark.favicon ?? null,
      bookmark.createdAt,
      bookmark.modifiedAt,
      position?.next_order ?? 0,
    )
    .run();
  await touchCollection(db, mark);
}

export async function updateBookmark(
  db: D1Database,
  mark: string,
  bookmark: BookmarkInstance,
): Promise<void> {
  await db
    .prepare(
      `UPDATE bookmarks SET
        url = ?, title = ?, description = ?, category = ?, favicon = ?, modified_at = ?
       WHERE uuid = ? AND mark = ?`,
    )
    .bind(
      bookmark.url,
      bookmark.title,
      bookmark.description ?? null,
      bookmark.category,
      bookmark.favicon ?? null,
      bookmark.modifiedAt,
      bookmark.uuid,
      mark,
    )
    .run();
  await touchCollection(db, mark);
}

export async function deleteBookmark(
  db: D1Database,
  mark: string,
  uuid: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM bookmarks WHERE uuid = ? AND mark = ?")
    .bind(uuid, mark)
    .run();
  if (result.meta.changes > 0) {
    await touchCollection(db, mark);
    return true;
  }
  return false;
}

export async function findBookmarkByUrl(
  db: D1Database,
  mark: string,
  url: string,
): Promise<BookmarkInstance | null> {
  const row = await db
    .prepare(
      `SELECT uuid, mark, url, title, description, category, favicon, created_at, modified_at
       FROM bookmarks WHERE mark = ? AND url = ?`,
    )
    .bind(mark, url)
    .first<BookmarkRow>();
  return row ? rowToBookmark(row) : null;
}

export async function findBookmarkByUuid(
  db: D1Database,
  mark: string,
  uuid: string,
): Promise<BookmarkInstance | null> {
  const row = await db
    .prepare(
      `SELECT uuid, mark, url, title, description, category, favicon, created_at, modified_at
       FROM bookmarks WHERE mark = ? AND uuid = ?`,
    )
    .bind(mark, uuid)
    .first<BookmarkRow>();
  return row ? rowToBookmark(row) : null;
}

export async function assertUnderBookmarkLimit(
  db: D1Database,
  mark: string,
): Promise<void> {
  const count = await countBookmarks(db, mark);
  if (count >= MAX_BOOKMARKS_PER_MARK) {
    throw new Error(
      `Collection has reached the maximum of ${MAX_BOOKMARKS_PER_MARK} bookmarks`,
    );
  }
}

/**
 * Insert many bookmarks in a single batch (import / bulk ops).
 */
export async function insertBookmarksBatch(
  db: D1Database,
  mark: string,
  bookmarks: BookmarkInstance[],
): Promise<void> {
  if (bookmarks.length === 0) return;

  const categoryOffsets = new Map<string, number>();
  const statements = bookmarks.map((b) => {
    const category = b.category || defaultCategory;
    const offset = categoryOffsets.get(category) ?? 0;
    categoryOffsets.set(category, offset + 1);
    return db
      .prepare(
        `INSERT OR IGNORE INTO bookmarks
          (uuid, mark, url, title, description, category, favicon, created_at, modified_at, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        b.uuid,
        mark,
        b.url,
        b.title,
        b.description ?? null,
        category,
        b.favicon ?? null,
        b.createdAt,
        b.modifiedAt,
        offset,
      )
  });

  // D1 batch max is large enough; chunk if needed
  const CHUNK = 50;
  for (let i = 0; i < statements.length; i += CHUNK) {
    await db.batch(statements.slice(i, i + CHUNK));
  }
  await touchCollection(db, mark);
}
