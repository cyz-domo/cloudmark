"use server";

import {
  type BookmarkInstance,
  type BookmarksData,
  type CollectionPageData,
  isDemoMark,
} from "@/lib/types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DEMO_BOOKMARKS_DATA } from "@/data/demo_data";
import { createServerAction } from "zsa";
import {
  claimSchema,
  deleteSchema,
  insertSchema,
  regenerateTokenSchema,
  updateSchema,
} from "./schema";
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
} from "./db";
import { migrateFromKvIfNeeded } from "./migrate";
import {
  checkRateLimit,
  hashWriteToken,
  isValidMarkFormat,
  verifyWriteToken,
} from "./security";
import { defaultCategory } from "./types";

function getEnv() {
  const ctx = getCloudflareContext();
  return {
    db: ctx.env.DB,
    kv: ctx.env.cloudmark as KVNamespace | undefined,
  };
}

function generateUUID(): string {
  return crypto.randomUUID();
}

export async function getFavicon(url: string, size: number = 64) {
  try {
    const domain = new URL(url).hostname.replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch {
    return "";
  }
}

/**
 * Load collection page data: D1 first, then auto-migrate from KV if present.
 * When migration happens, issues a one-time plaintext write token for the client.
 */
export async function getCollectionPageData(data: {
  mark: string;
}): Promise<CollectionPageData> {
  const { mark } = data;

  if (isDemoMark(mark)) {
    return {
      bookmarksData: DEMO_BOOKMARKS_DATA,
      exists: true,
    };
  }

  // Reject path-like / clearly invalid marks; allow legacy marks that may be short
  if (!mark || mark.length > 128 || /[^a-zA-Z0-9_-]/.test(mark)) {
    return { bookmarksData: null, exists: false };
  }

  const { db, kv } = getEnv();

  const existing = await getCollection(db, mark);
  if (existing) {
    const bookmarksData = await getBookmarksData(db, mark);
    return {
      bookmarksData,
      exists: true,
      migratedFromKv: existing.migrated_from_kv === 1,
    };
  }

  // Try KV → D1 migration for legacy collections
  const migration = await migrateFromKvIfNeeded(db, kv, mark);
  if (migration) {
    return {
      bookmarksData: migration.bookmarksData,
      exists: true,
      issuedWriteToken: migration.issuedWriteToken,
      migratedFromKv: true,
    };
  }

  // Empty / not yet claimed — only offer claim UI for valid new marks
  if (!isValidMarkFormat(mark)) {
    return { bookmarksData: null, exists: false };
  }

  return { bookmarksData: null, exists: false };
}

/** @deprecated Use getCollectionPageData */
export async function getBookmarkData(data: {
  mark: string;
}): Promise<BookmarksData | null> {
  const page = await getCollectionPageData(data);
  return page.bookmarksData;
}

function isAcceptableMark(mark: string): boolean {
  return Boolean(mark) && mark.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(mark);
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
    throw new Error("Collection not found. Claim it first with your write token.");
  }

  const ok = await verifyWriteToken(token, collection.write_token_hash);
  if (!ok) {
    throw new Error("Invalid write token");
  }
}

/**
 * Claim a new collection (or ensure it exists with the given token).
 * If the collection does not exist, creates it. If it exists, verifies the token.
 */
export const claimCollectionAction = createServerAction()
  .input(claimSchema, { type: "formData" })
  .handler(async ({ input }) => {
    const { mark, token } = input;
    if (isDemoMark(mark)) {
      throw new Error("Demo mode");
    }

    const { db } = getEnv();
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
      return { mark, created: false as const };
    }

    const writeTokenHash = await hashWriteToken(token);
    try {
      await createCollection(db, mark, writeTokenHash);
    } catch {
      // Concurrent claim — re-verify
      const raced = await getCollection(db, mark);
      if (!raced) {
        throw new Error("Failed to create collection");
      }
      const ok = await verifyWriteToken(token, raced.write_token_hash);
      if (!ok) {
        throw new Error("Collection already exists with a different write token");
      }
      return { mark, created: false as const };
    }

    return { mark, created: true as const };
  });

/**
 * Rotate the write token. Requires the current valid token.
 */
export const regenerateTokenAction = createServerAction()
  .input(regenerateTokenSchema, { type: "formData" })
  .handler(async ({ input }) => {
    const { mark, currentToken, newToken } = input;
    const { db } = getEnv();
    await requireWriteAccess(db, mark, currentToken, `regen:${mark}`);

    const newHash = await hashWriteToken(newToken);
    await updateCollectionToken(db, mark, newHash);
    return { mark, token: newToken };
  });

/**
 * Creates a new bookmark. Auto-claims the collection if it does not exist yet
 * (first write with a token becomes the owner).
 */
export const createBookmarkAction = createServerAction()
  .input(insertSchema, { type: "formData" })
  .handler(async ({ input }) => {
    const { mark, token, url, title, description, category } = input;
    if (isDemoMark(mark)) {
      throw new Error("Demo mode");
    }
    if (!isAcceptableMark(mark)) {
      throw new Error("Invalid mark");
    }

    const { db } = getEnv();
    const allowed = await checkRateLimit(db, `write:${mark}`);
    if (!allowed) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    let collection = await getCollection(db, mark);
    if (!collection) {
      // New collections must use the strict mark format
      if (!isValidMarkFormat(mark)) {
        throw new Error("Invalid mark format for new collection");
      }
      // First write claims the collection
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

    const uuid = generateUUID();
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
      // Unique constraint on (mark, url)
      throw new Error(`Bookmark ${title} (${url}) already exists`);
    }

    return newBookmark;
  });

export const updateBookmarkAction = createServerAction()
  .input(updateSchema, { type: "formData" })
  .handler(async ({ input }) => {
    const { mark, token, uuid, url, title, description, category } = input;
    const { db } = getEnv();
    await requireWriteAccess(db, mark, token, `write:${mark}`);

    const existing = await findBookmarkByUuid(db, mark, uuid);
    if (!existing) {
      throw new Error(`Bookmark with UUID ${uuid} not found`);
    }

    // If URL changed, ensure no conflict
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
  });

export const deleteBookmarkAction = createServerAction()
  .input(deleteSchema, { type: "formData" })
  .handler(async ({ input }) => {
    const { mark, token, uuid } = input;
    const { db } = getEnv();
    await requireWriteAccess(db, mark, token, `write:${mark}`);

    const deleted = await deleteBookmark(db, mark, uuid);
    if (!deleted) {
      throw new Error(`Bookmark with UUID ${uuid} not found`);
    }
    return;
  });
