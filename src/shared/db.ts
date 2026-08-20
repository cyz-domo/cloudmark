import type {
  BookmarkInstance,
  BookmarksData,
  CollectionSettings,
  SortProfile,
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
  home_category: string;
  is_public: number;
  background_url: string;
  category_order: string;
}

export function rowToSettings(row: CollectionRow): CollectionSettings {
  return {
    redirectAfterSave: row.redirect_after_save !== 0,
    defaultCategory: row.default_category || DEFAULT_COLLECTION_SETTINGS.defaultCategory,
    homeCategory: row.home_category || "",
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
              COALESCE(home_category, '') as home_category,
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

export async function getSortProfiles(db: D1Database, mark: string): Promise<SortProfile[]> {
  const profiles = await db.prepare("SELECT id, category, name FROM sort_profiles WHERE mark = ? ORDER BY category ASC, name ASC").bind(mark).all<{ id: string; category: string; name: string }>();
  const result: SortProfile[] = [];
  for (const profile of profiles.results ?? []) {
    const items = await db.prepare("SELECT category, uuid FROM sort_profile_items WHERE profile_id = ? ORDER BY category ASC, sort_order ASC").bind(profile.id).all<{ category: string; uuid: string }>();
    const grouped = new Map<string, string[]>();
    for (const item of items.results ?? []) grouped.set(item.category, [...(grouped.get(item.category) ?? []), item.uuid]);
    result.push({ id: profile.id, category: profile.category, name: profile.name, orders: [...grouped].map(([category, uuids]) => ({ category, uuids })) });
  }
  return result;
}

export async function sortProfileBelongsToCollection(db: D1Database, mark: string, id: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS found FROM sort_profiles WHERE id = ? AND mark = ?").bind(id, mark).first<{ found: number }>();
  return Boolean(row);
}

export async function createSortProfile(db: D1Database, mark: string, category: string, id: string, name: string): Promise<SortProfile> {
  const now = new Date().toISOString();
  await db.prepare("INSERT INTO sort_profiles (id, mark, category, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, mark, category, name, now, now).run();
  return { id, category, name, orders: [] };
}

export async function renameSortProfile(db: D1Database, mark: string, id: string, name: string): Promise<boolean> {
  const result = await db.prepare("UPDATE sort_profiles SET name = ?, updated_at = ? WHERE id = ? AND mark = ?").bind(name, new Date().toISOString(), id, mark).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function deleteSortProfile(db: D1Database, mark: string, id: string): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM sort_profile_items WHERE profile_id = ? AND mark = ?").bind(id, mark),
    db.prepare("DELETE FROM sort_profiles WHERE id = ? AND mark = ?").bind(id, mark),
    db.prepare("DELETE FROM category_sorts WHERE mark = ? AND value = ?").bind(mark, id),
  ]);
}

export async function getCategorySorts(db: D1Database, mark: string): Promise<Record<string, string>> {
  const { results } = await db.prepare("SELECT category, value FROM category_sorts WHERE mark = ?").bind(mark).all<{ category: string; value: string }>();
  const out: Record<string, string> = {};
  for (const row of results ?? []) out[row.category] = row.value || "";
  return out;
}

export async function saveCategorySorts(db: D1Database, mark: string, sorts: Array<{ category: string; value: string }>): Promise<void> {
  if (!sorts.length) return;
  const now = new Date().toISOString();
  const statements = sorts.map((sort) =>
    db.prepare("INSERT INTO category_sorts (mark, category, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(mark, category) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(mark, sort.category, sort.value || "", now),
  );
  await db.batch(statements);
}

export async function updateSortProfileOrders(db: D1Database, mark: string, id: string, orders: Array<{ category: string; uuids: string[] }>): Promise<void> {
  const profile = await db.prepare("SELECT category FROM sort_profiles WHERE id = ? AND mark = ?").bind(id, mark).first<{ category: string }>();
  if (!profile) throw new Error("Sort profile not found");
  if (orders.some((order) => order.category !== profile.category)) {
    throw new Error("Sort profile can only contain its own group");
  }
  const now = new Date().toISOString();
  const statements = [
    db.prepare("DELETE FROM sort_profile_items WHERE profile_id = ? AND mark = ?").bind(id, mark),
    ...orders.flatMap((order) => order.uuids.map((uuid, index) => db.prepare("INSERT INTO sort_profile_items (profile_id, mark, category, uuid, sort_order) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM sort_profiles WHERE id = ? AND mark = ?) AND EXISTS (SELECT 1 FROM bookmarks WHERE uuid = ? AND mark = ? AND category = ?)").bind(id, mark, order.category, uuid, index, id, mark, uuid, mark, order.category))),
    db.prepare("UPDATE sort_profiles SET updated_at = ? WHERE id = ? AND mark = ?").bind(now, id, mark),
  ];
  await db.batch(statements);
}

export async function renameCategory(db: D1Database, mark: string, from: string, to: string, paths: string[], order: string[], defaultCategory: string, homeCategory: string): Promise<void> {
  const now = new Date().toISOString();
  const renamed = paths.map((path) => ({ from: path, to: path === from ? to : `${to} / ${path.slice(from.length + 3)}` }));
  await db.batch([
    ...renamed.map(({ from: path, to: next }) => db.prepare("UPDATE bookmarks SET category = ? WHERE mark = ? AND category = ?").bind(next, mark, path)),
    db.prepare("UPDATE collections SET category_order = ?, default_category = ?, home_category = ?, updated_at = ? WHERE mark = ?")
      .bind(JSON.stringify(order), defaultCategory, homeCategory, now, mark),
    ...renamed.map(({ from: path, to: next }) => db.prepare("UPDATE sort_profile_items SET category = ? WHERE mark = ? AND category = ?").bind(next, mark, path)),
    ...renamed.map(({ from: path, to: next }) => db.prepare("UPDATE sort_profiles SET category = ? WHERE mark = ? AND category = ?").bind(next, mark, path)),
    ...renamed.map(({ from: path, to: next }) => db.prepare("UPDATE category_sorts SET category = ? WHERE mark = ? AND category = ?").bind(next, mark, path)),
  ]);
}

export async function deleteCategory(db: D1Database, mark: string, category: string, paths: string[], order: string[]): Promise<number> {
  const results = await db.batch([
    ...paths.map((path) => db.prepare("DELETE FROM bookmarks WHERE mark = ? AND category = ?").bind(mark, path)),
    db.prepare("UPDATE collections SET category_order = ?, default_category = CASE WHEN default_category = ? OR default_category LIKE ? THEN 'default' ELSE default_category END, home_category = CASE WHEN home_category = ? OR home_category LIKE ? THEN '' ELSE home_category END, updated_at = ? WHERE mark = ?")
      .bind(JSON.stringify(order), category, `${category} / %`, category, `${category} / %`, new Date().toISOString(), mark),
    db.prepare("DELETE FROM sort_profile_items WHERE mark = ? AND (category = ? OR category LIKE ?)")
      .bind(mark, category, `${category} / %`),
    db.prepare("DELETE FROM sort_profiles WHERE mark = ? AND (category = ? OR category LIKE ?)")
      .bind(mark, category, `${category} / %`),
    db.prepare("DELETE FROM category_sorts WHERE mark = ? AND (category = ? OR category LIKE ?)")
      .bind(mark, category, `${category} / %`),
  ]);
  return results.reduce((total, result) => total + (result.meta.changes ?? 0), 0);
}

export async function deleteBookmarks(db: D1Database, mark: string, uuids: string[]): Promise<number> {
  if (!uuids.length) return 0;
  const result = await db.batch([
    ...uuids.map((uuid) => db.prepare("DELETE FROM bookmarks WHERE mark = ? AND uuid = ?").bind(mark, uuid)),
    ...uuids.map((uuid) => db.prepare("DELETE FROM sort_profile_items WHERE mark = ? AND uuid = ?").bind(mark, uuid)),
  ]);
  const deleted = result.slice(0, uuids.length).reduce((sum, item) => sum + (item.meta.changes ?? 0), 0);
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
         redirect_after_save, default_category, home_category, is_public, background_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      settings.homeCategory || "",
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
           home_category = ?,
           is_public = ?,
           background_url = ?,
           updated_at = ?
       WHERE mark = ?`,
    )
    .bind(
      settings.redirectAfterSave ? 1 : 0,
      settings.defaultCategory || defaultCategory,
      settings.homeCategory || "",
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
    await db.prepare("DELETE FROM sort_profile_items WHERE mark = ? AND uuid = ?").bind(mark, uuid).run();
    await touchCollection(db, mark);
    return true;
  }
  return false;
}

export async function findBookmarkByUrl(
  db: D1Database,
  mark: string,
  url: string,
  category?: string,
): Promise<BookmarkInstance | null> {
  const categoryClause = category === undefined ? "" : " AND category = ?";
  const row = await db
    .prepare(
      `SELECT uuid, mark, url, title, description, category, favicon, created_at, modified_at
       FROM bookmarks WHERE mark = ? AND url = ?${categoryClause}`,
    )
    .bind(...(category === undefined ? [mark, url] : [mark, url, category]))
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
