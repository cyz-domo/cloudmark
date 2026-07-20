import type { BookmarksData, BookmarkInstance } from "./types";
import {
  createCollection,
  getCollection,
  getBookmarksData,
  insertBookmarksBatch,
} from "./db";
import { generateWriteToken, hashWriteToken } from "./security";

export interface MigrationResult {
  bookmarksData: BookmarksData;
  /** Plaintext write token — only present when the collection was just migrated */
  issuedWriteToken: string;
  migratedFromKv: true;
}

/**
 * Attempt to migrate a collection from legacy KV storage into D1.
 * Returns null if no KV data exists for this mark.
 *
 * On success:
 * - Creates a D1 collection with a fresh write token
 * - Copies all bookmarks into D1
 * - Leaves KV data intact (read-only backup) so re-runs are safe via D1 existence check
 *
 * Legacy marks may not meet the new strict mark format; migration still allows them.
 */
export async function migrateFromKvIfNeeded(
  db: D1Database,
  kv: KVNamespace | undefined,
  mark: string,
): Promise<MigrationResult | null> {
  // Legacy KV marks may include spaces / punctuation; only reject empty,
  // oversized, or path/control characters that would break storage.
  if (
    !kv ||
    !mark ||
    mark.length > 128 ||
    /[\0\n\r\\]/.test(mark) ||
    mark.includes("..")
  ) {
    return null;
  }

  // Already in D1 — nothing to do
  const existing = await getCollection(db, mark);
  if (existing) {
    return null;
  }

  let kvData: BookmarksData | null = null;
  try {
    kvData = await kv.get<BookmarksData>(mark, "json");
  } catch {
    return null;
  }

  if (!kvData || !Array.isArray(kvData.bookmarks)) {
    return null;
  }

  const writeToken = generateWriteToken();
  const writeTokenHash = await hashWriteToken(writeToken);

  try {
    await createCollection(db, mark, writeTokenHash, { migratedFromKv: true });
  } catch {
    // Race: another request migrated first — load from D1 without re-issuing token
    const data = await getBookmarksData(db, mark);
    if (data) {
      return null;
    }
    throw new Error("Failed to create collection during migration");
  }

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  const bookmarks: BookmarkInstance[] = kvData.bookmarks
    .filter((b) => b && typeof b.url === "string" && typeof b.title === "string")
    .map((b) => ({
      uuid: b.uuid && uuidRe.test(b.uuid) ? b.uuid : crypto.randomUUID(),
      url: String(b.url).slice(0, 2048),
      title: String(b.title).slice(0, 200) || "Untitled",
      description:
        typeof b.description === "string"
          ? b.description.slice(0, 2000)
          : undefined,
      category:
        typeof b.category === "string" && b.category
          ? b.category.slice(0, 50)
          : "default",
      favicon: typeof b.favicon === "string" ? b.favicon : undefined,
      createdAt: b.createdAt || new Date().toISOString(),
      modifiedAt: b.modifiedAt || b.createdAt || new Date().toISOString(),
    }));

  await insertBookmarksBatch(db, mark, bookmarks);

  const bookmarksData = await getBookmarksData(db, mark);
  if (!bookmarksData) {
    throw new Error("Migration completed but collection not found");
  }

  return {
    bookmarksData,
    issuedWriteToken: writeToken,
    migratedFromKv: true,
  };
}
