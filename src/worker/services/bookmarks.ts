import { DEMO_BOOKMARKS_DATA } from "@/shared/demo_data";
import {
  assertUnderBookmarkLimit,
  countBookmarks,
  createCollection,
  deleteBookmark,
  findBookmarkByUrl,
  findBookmarkByUuid,
  getBookmarksForMark,
  getBookmarksData,
  getCollection,
  insertBookmark,
  insertBookmarksBatch,
  markTokenDelivered,
  rotateCollectionToken,
  updateBookmark,
  updateCollectionToken,
} from "@/shared/db";
import { MAX_BOOKMARKS_PER_MARK } from "@/shared/constants";
import type { ImportItemSchema } from "@/shared/schema";
import {
  checkRateLimit,
  generateWriteToken,
  hashWriteToken,
  isValidMarkFormat,
  verifyWriteToken,
} from "@/shared/security";
import {
  type BookmarkInstance,
  type CollectionPageData,
  defaultCategory,
  isDemoMark,
} from "@/shared/types";

export async function getFavicon(url: string, size: number = 64) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch {
    return "";
  }
}

/** Marks allowed for write ops on existing collections (incl. legacy). */
function isAcceptableMark(mark: string): boolean {
  return (
    Boolean(mark) &&
    mark.length <= 128 &&
    !/[\0\n\r\\]/.test(mark) &&
    !mark.includes("..")
  );
}

export async function getCollectionPageData(
  db: D1Database,
  mark: string,
): Promise<CollectionPageData> {
  if (isDemoMark(mark)) {
    return {
      bookmarksData: DEMO_BOOKMARKS_DATA,
      exists: true,
    };
  }

  if (!isAcceptableMark(mark)) {
    return { bookmarksData: null, exists: false };
  }

  const existing = await getCollection(db, mark);
  if (existing) {
    const bookmarksData = await getBookmarksData(db, mark);
    // Collections with token_delivered=0: issue write token once on first open
    if (existing.token_delivered === 0) {
      const issuedWriteToken = generateWriteToken();
      const hash = await hashWriteToken(issuedWriteToken);
      await rotateCollectionToken(db, mark, hash, { delivered: true });
      await markTokenDelivered(db, mark);
      return {
        bookmarksData,
        exists: true,
        issuedWriteToken,
        migratedFromKv: existing.migrated_from_kv === 1,
      };
    }
    return {
      bookmarksData,
      exists: true,
      migratedFromKv: existing.migrated_from_kv === 1,
    };
  }

  // Empty shell for valid new marks (first write claims the collection)
  if (!isValidMarkFormat(mark)) {
    return { bookmarksData: null, exists: false };
  }

  return { bookmarksData: null, exists: false };
}

async function requireWriteAccess(
  db: D1Database,
  mark: string,
  token: string,
  rateKey: string,
): Promise<void> {
  if (isDemoMark(mark)) {
    throw new Error("Demo mode");
  }
  if (!isAcceptableMark(mark)) {
    throw new Error("Invalid mark");
  }

  const allowed = await checkRateLimit(db, rateKey);
  if (!allowed) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  const collection = await getCollection(db, mark);
  if (!collection) {
    throw new Error(
      "Collection not found. Claim it first with your write token.",
    );
  }

  const ok = await verifyWriteToken(token, collection.write_token_hash);
  if (!ok) {
    throw new Error("Invalid write token");
  }
}

export async function claimCollection(
  db: D1Database,
  mark: string,
  token: string,
): Promise<{ mark: string; created: boolean }> {
  if (isDemoMark(mark)) {
    throw new Error("Demo mode");
  }

  const allowed = await checkRateLimit(db, `claim:${mark}`);
  if (!allowed) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  const existing = await getCollection(db, mark);
  if (existing) {
    const ok = await verifyWriteToken(token, existing.write_token_hash);
    if (!ok) {
      throw new Error("Collection already exists with a different write token");
    }
    return { mark, created: false };
  }

  const writeTokenHash = await hashWriteToken(token);
  try {
    await createCollection(db, mark, writeTokenHash);
  } catch {
    const raced = await getCollection(db, mark);
    if (!raced) {
      throw new Error("Failed to create collection");
    }
    const ok = await verifyWriteToken(token, raced.write_token_hash);
    if (!ok) {
      throw new Error("Collection already exists with a different write token");
    }
    return { mark, created: false };
  }

  return { mark, created: true };
}

export async function regenerateToken(
  db: D1Database,
  mark: string,
  currentToken: string,
  newToken: string,
): Promise<{ mark: string; token: string }> {
  await requireWriteAccess(db, mark, currentToken, `regen:${mark}`);
  const newHash = await hashWriteToken(newToken);
  await updateCollectionToken(db, mark, newHash);
  return { mark, token: newToken };
}

export async function createBookmark(
  db: D1Database,
  input: {
    mark: string;
    token: string;
    url: string;
    title: string;
    description?: string;
    category: string;
    favicon?: string;
  },
): Promise<BookmarkInstance> {
  const { mark, token, url, title, description, category, favicon: customFavicon } =
    input;
  if (isDemoMark(mark)) {
    throw new Error("Demo mode");
  }
  if (!isAcceptableMark(mark)) {
    throw new Error("Invalid mark");
  }

  const allowed = await checkRateLimit(db, `write:${mark}`);
  if (!allowed) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  let collection = await getCollection(db, mark);
  if (!collection) {
    if (!isValidMarkFormat(mark)) {
      throw new Error("Invalid mark format for new collection");
    }
    const writeTokenHash = await hashWriteToken(token);
    try {
      await createCollection(db, mark, writeTokenHash);
    } catch {
      collection = await getCollection(db, mark);
      if (!collection) {
        throw new Error("Failed to create collection");
      }
      const ok = await verifyWriteToken(token, collection.write_token_hash);
      if (!ok) {
        throw new Error("Invalid write token");
      }
    }
  } else {
    const ok = await verifyWriteToken(token, collection.write_token_hash);
    if (!ok) {
      throw new Error("Invalid write token");
    }
  }

  await assertUnderBookmarkLimit(db, mark);

  const duplicate = await findBookmarkByUrl(db, mark, url);
  if (duplicate) {
    throw new Error(`Bookmark ${title} (${url}) already exists`);
  }

  const uuid = crypto.randomUUID();
  const favicon =
    customFavicon && customFavicon.length > 0
      ? customFavicon
      : await getFavicon(url);
  const now = new Date().toISOString();
  const newBookmark: BookmarkInstance = {
    uuid,
    url,
    title,
    description,
    category: category || defaultCategory,
    favicon,
    createdAt: now,
    modifiedAt: now,
  };

  try {
    await insertBookmark(db, mark, newBookmark);
  } catch {
    throw new Error(`Bookmark ${title} (${url}) already exists`);
  }

  return newBookmark;
}

export async function updateBookmarkRecord(
  db: D1Database,
  input: {
    mark: string;
    token: string;
    uuid: string;
    url: string;
    title: string;
    description?: string;
    category: string;
    /** When provided (including empty string), replaces favicon. Omit to auto-handle. */
    favicon?: string | null;
  },
): Promise<BookmarkInstance> {
  const {
    mark,
    token,
    uuid,
    url,
    title,
    description,
    category,
    favicon: faviconInput,
  } = input;
  await requireWriteAccess(db, mark, token, `write:${mark}`);

  const existing = await findBookmarkByUuid(db, mark, uuid);
  if (!existing) {
    throw new Error(`Bookmark with UUID ${uuid} not found`);
  }

  if (url !== existing.url) {
    const conflict = await findBookmarkByUrl(db, mark, url);
    if (conflict && conflict.uuid !== uuid) {
      throw new Error(`Bookmark with URL ${url} already exists`);
    }
  }

  let favicon = existing.favicon;
  if (faviconInput !== undefined && faviconInput !== null) {
    // Explicit client value: non-empty custom icon, or empty → re-fetch site icon
    favicon =
      faviconInput.length > 0 ? faviconInput : await getFavicon(url);
  } else if (url !== existing.url) {
    favicon = await getFavicon(url);
  }

  const updatedBookmark: BookmarkInstance = {
    ...existing,
    url,
    title,
    description,
    category: category || defaultCategory,
    favicon,
    modifiedAt: new Date().toISOString(),
  };

  await updateBookmark(db, mark, updatedBookmark);
  return updatedBookmark;
}

export async function deleteBookmarkRecord(
  db: D1Database,
  input: { mark: string; token: string; uuid: string },
): Promise<void> {
  const { mark, token, uuid } = input;
  await requireWriteAccess(db, mark, token, `write:${mark}`);

  const deleted = await deleteBookmark(db, mark, uuid);
  if (!deleted) {
    throw new Error(`Bookmark with UUID ${uuid} not found`);
  }
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
  bookmarks: BookmarkInstance[];
}

/**
 * Bulk-import bookmarks (Netscape HTML / JSON). One rate-limit unit per request.
 * Skips duplicate URLs when skipDuplicates is true.
 */
export async function importBookmarks(
  db: D1Database,
  input: {
    mark: string;
    token: string;
    bookmarks: ImportItemSchema[];
    skipDuplicates?: boolean;
  },
): Promise<ImportResult> {
  const { mark, token, bookmarks, skipDuplicates = true } = input;
  if (isDemoMark(mark)) {
    throw new Error("Demo mode");
  }
  if (!isAcceptableMark(mark)) {
    throw new Error("Invalid mark");
  }

  const allowed = await checkRateLimit(db, `import:${mark}`);
  if (!allowed) {
    throw new Error("Rate limit exceeded. Please try again later.");
  }

  let collection = await getCollection(db, mark);
  if (!collection) {
    if (!isValidMarkFormat(mark)) {
      throw new Error("Invalid mark format for new collection");
    }
    const writeTokenHash = await hashWriteToken(token);
    try {
      await createCollection(db, mark, writeTokenHash);
    } catch {
      collection = await getCollection(db, mark);
      if (!collection) throw new Error("Failed to create collection");
      const ok = await verifyWriteToken(token, collection.write_token_hash);
      if (!ok) throw new Error("Invalid write token");
    }
  } else {
    const ok = await verifyWriteToken(token, collection.write_token_hash);
    if (!ok) throw new Error("Invalid write token");
  }

  const existingCount = await countBookmarks(db, mark);
  const room = MAX_BOOKMARKS_PER_MARK - existingCount;
  if (room <= 0) {
    throw new Error(
      `Collection has reached the maximum of ${MAX_BOOKMARKS_PER_MARK} bookmarks`,
    );
  }

  const existing = await getBookmarksForMark(db, mark);
  const existingUrls = new Set(existing.map((b) => b.url));

  // Dedupe within the import payload by URL
  const seen = new Set<string>();
  const toInsert: BookmarkInstance[] = [];
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of bookmarks) {
    const url = item.url.trim();
    if (seen.has(url)) {
      skipped += 1;
      continue;
    }
    seen.add(url);

    if (toInsert.length >= room) {
      skipped += 1;
      continue;
    }

    try {
      if (skipDuplicates && existingUrls.has(url)) {
        skipped += 1;
        continue;
      }
      if (!skipDuplicates && existingUrls.has(url)) {
        skipped += 1;
        continue;
      }

      const now = new Date().toISOString();
      let createdAt = now;
      if (item.createdAt) {
        const d = new Date(item.createdAt);
        if (!Number.isNaN(d.getTime())) createdAt = d.toISOString();
      }

      // Skip remote favicon fetch in bulk for speed; client can re-fetch later
      let favicon = "";
      try {
        const domain = new URL(url).hostname.replace(/^www\./, "");
        favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
      } catch {
        favicon = "";
      }

      toInsert.push({
        uuid: crypto.randomUUID(),
        url,
        title: item.title || url,
        description: item.description,
        category: item.category || defaultCategory,
        favicon,
        createdAt,
        modifiedAt: now,
      });
      existingUrls.add(url);
    } catch (e) {
      failed += 1;
      if (errors.length < 10) {
        errors.push(e instanceof Error ? e.message : "import item failed");
      }
    }
  }

  if (toInsert.length > 0) {
    await insertBookmarksBatch(db, mark, toInsert);
  }

  return {
    imported: toInsert.length,
    skipped,
    failed,
    errors,
    bookmarks: toInsert,
  };
}
