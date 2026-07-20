import { DEMO_BOOKMARKS_DATA } from "@/shared/demo_data";
import {
  assertUnderBookmarkLimit,
  createCollection,
  deleteBookmark,
  findBookmarkByUrl,
  findBookmarkByUuid,
  getBookmarksData,
  getCollection,
  insertBookmark,
  updateBookmark,
  updateCollectionToken,
} from "@/shared/db";
import { migrateFromKvIfNeeded } from "@/shared/migrate";
import {
  checkRateLimit,
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

function isAcceptableMark(mark: string): boolean {
  return Boolean(mark) && mark.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(mark);
}

export async function getCollectionPageData(
  db: D1Database,
  kv: KVNamespace | undefined,
  mark: string,
): Promise<CollectionPageData> {
  if (isDemoMark(mark)) {
    return {
      bookmarksData: DEMO_BOOKMARKS_DATA,
      exists: true,
    };
  }

  if (!mark || mark.length > 128 || /[^a-zA-Z0-9_-]/.test(mark)) {
    return { bookmarksData: null, exists: false };
  }

  const existing = await getCollection(db, mark);
  if (existing) {
    const bookmarksData = await getBookmarksData(db, mark);
    return {
      bookmarksData,
      exists: true,
      migratedFromKv: existing.migrated_from_kv === 1,
    };
  }

  const migration = await migrateFromKvIfNeeded(db, kv, mark);
  if (migration) {
    return {
      bookmarksData: migration.bookmarksData,
      exists: true,
      issuedWriteToken: migration.issuedWriteToken,
      migratedFromKv: true,
    };
  }

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
  },
): Promise<BookmarkInstance> {
  const { mark, token, url, title, description, category } = input;
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
  const favicon = await getFavicon(url);
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
  },
): Promise<BookmarkInstance> {
  const { mark, token, uuid, url, title, description, category } = input;
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

  const favicon =
    url !== existing.url ? await getFavicon(url) : existing.favicon;

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
