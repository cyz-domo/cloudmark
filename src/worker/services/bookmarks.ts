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
  rowToSettings,
  updateBookmark,
  updateCollectionSettings,
  reorderBookmarks,
  updateCollectionToken,
  getCategoryOrder,
  updateCategoryOrder,
  renameCategory,
  deleteCategory,
  deleteBookmarks,
  getSortProfiles,
  createSortProfile,
  renameSortProfile,
  deleteSortProfile,
  updateSortProfileOrders,
  sortProfileBelongsToCollection,
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
  type CollectionSettings,
  DEFAULT_COLLECTION_SETTINGS,
  defaultCategory,
  isDemoMark,
} from "@/shared/types";

const FIXED_HOME_SORTS = new Set(["newest", "oldest", "title", "title-desc", "category", "category-desc", "url", "url-desc"]);

export async function getFavicon(url: string, size: number = 64) {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, "");
    const candidates = [
      `${parsed.origin}/favicon.ico`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`,
    ];
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate, { method: "HEAD", redirect: "follow" });
        if (response.ok) return candidate;
      } catch {
        // Try the next favicon source.
      }
    }
    return candidates[1];
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
  viewToken?: string | null,
): Promise<CollectionPageData> {
  if (isDemoMark(mark)) {
    return {
      bookmarksData: DEMO_BOOKMARKS_DATA,
      exists: true,
      settings: { ...DEFAULT_COLLECTION_SETTINGS },
      categories: [],
      sortProfiles: [],
    };
  }

  if (!isAcceptableMark(mark)) {
    return { bookmarksData: null, exists: false };
  }

  const existing = await getCollection(db, mark);
  if (existing) {
    const settings = rowToSettings(existing);

    // Private collection: require a valid write token to view bookmarks
    if (!settings.isPublic) {
      const ok =
        Boolean(viewToken) &&
        (await verifyWriteToken(viewToken!, existing.write_token_hash));
      if (!ok) {
        return {
          bookmarksData: null,
          exists: true,
          settings,
          privateLocked: true,
          migratedFromKv: existing.migrated_from_kv === 1,
        };
      }
    }

    const sortProfiles = await getSortProfiles(db, mark);

    const bookmarksData = await getBookmarksData(db, mark);
    const discovered = [...new Set((bookmarksData?.bookmarks ?? []).map((bookmark) => bookmark.category))];
    const saved = getCategoryOrder(existing);
    const categories = [...saved, ...discovered.filter((category) => !saved.includes(category))];
    // Collections with token_delivered=0: issue write token once on first open
    if (existing.token_delivered === 0) {
      const issuedWriteToken = generateWriteToken();
      const hash = await hashWriteToken(issuedWriteToken);
      await rotateCollectionToken(db, mark, hash, { delivered: true });
      await markTokenDelivered(db, mark);
      return {
        bookmarksData,
        exists: true,
        settings,
        issuedWriteToken,
        migratedFromKv: existing.migrated_from_kv === 1,
        categories,
        sortProfiles,
      };
    }
    return {
      bookmarksData,
      exists: true,
      settings,
      migratedFromKv: existing.migrated_from_kv === 1,
      categories,
      sortProfiles,
    };
  }

  // Empty shell for valid new marks (first write claims the collection)
  if (!isValidMarkFormat(mark)) {
    return { bookmarksData: null, exists: false };
  }

  return {
    bookmarksData: null,
    exists: false,
    settings: { ...DEFAULT_COLLECTION_SETTINGS },
  };
}

async function requireCollectionWrite(db: D1Database, mark: string, token: string) {
  await requireWriteAccess(db, mark, token, `collection:${mark}`);
  const collection = await getCollection(db, mark);
  if (!collection) throw new Error("Collection not found");
  return collection;
}

export async function reorderCollectionCategories(db: D1Database, mark: string, token: string, categories: string[]) {
  await requireCollectionWrite(db, mark, token);
  if (new Set(categories).size !== categories.length) throw new Error("分类列表不匹配");
  await updateCategoryOrder(db, mark, categories);
}

export async function renameCollectionCategory(db: D1Database, mark: string, token: string, from: string, to: string) {
  const collection = await requireCollectionWrite(db, mark, token);
  if (from === defaultCategory || to === defaultCategory) throw new Error("default 分类不能重命名");
  if (from === to) return;
  const categories = new Set([...getCategoryOrder(collection), ...(await getBookmarksForMark(db, mark)).map((bookmark) => bookmark.category)]);
  const hasFrom = categories.has(from) || [...categories].some((category) => category.startsWith(`${from} / `));
  if (!hasFrom || [...categories].some((category) => category === to || category.startsWith(`${to} / `))) throw new Error("分类不存在或名称已存在");
  const paths = [...categories].filter((category) => category === from || category.startsWith(`${from} / `));
  const order = getCategoryOrder(collection).map((category) => category === from || category.startsWith(`${from} / `) ? `${to}${category.slice(from.length)}` : category);
  const currentDefault = collection.default_category;
  const nextDefault = currentDefault === from || currentDefault.startsWith(`${from} / `)
    ? `${to}${currentDefault.slice(from.length)}`
    : currentDefault;
  const currentHome = collection.home_category || "";
  const nextHome = currentHome === from || currentHome.startsWith(`${from} / `)
    ? `${to}${currentHome.slice(from.length)}`
    : currentHome;
  await renameCategory(db, mark, from, to, paths, order, nextDefault, nextHome);
}

export async function deleteCollectionCategory(db: D1Database, mark: string, token: string, category: string) {
  const collection = await requireCollectionWrite(db, mark, token);
  if (category === defaultCategory) throw new Error("default 分类不能删除");
  const categories = new Set([...getCategoryOrder(collection), ...(await getBookmarksForMark(db, mark)).map((bookmark) => bookmark.category)]);
  if (!categories.has(category) && ![...categories].some((item) => item.startsWith(`${category} / `))) throw new Error("分类不存在");
  const paths = [...categories].filter((item) => item === category || item.startsWith(`${category} / `));
  return deleteCategory(db, mark, category, paths, getCategoryOrder(collection).filter((item) => !paths.includes(item)));
}

export async function listCollectionSortProfiles(db: D1Database, mark: string, token: string) {
  await requireWriteAccess(db, mark, token, `sort-profiles:${mark}`);
  return getSortProfiles(db, mark);
}

export async function createCollectionSortProfile(db: D1Database, mark: string, token: string, id: string, name: string) {
  await requireWriteAccess(db, mark, token, `sort-profiles:${mark}`);
  return createSortProfile(db, mark, id, name);
}

export async function renameCollectionSortProfile(db: D1Database, mark: string, token: string, id: string, name: string) {
  await requireWriteAccess(db, mark, token, `sort-profiles:${mark}`);
  if (!(await renameSortProfile(db, mark, id, name))) throw new Error("Sort profile not found");
}

export async function deleteCollectionSortProfile(db: D1Database, mark: string, token: string, id: string) {
  await requireWriteAccess(db, mark, token, `sort-profiles:${mark}`);
  await deleteSortProfile(db, mark, id);
}

export async function saveCollectionSortProfileOrders(db: D1Database, mark: string, token: string, id: string, orders: Array<{ category: string; uuids: string[] }>) {
  await requireWriteAccess(db, mark, token, `sort-profiles:${mark}`);
  if (!(await sortProfileBelongsToCollection(db, mark, id))) throw new Error("Sort profile not found");
  await updateSortProfileOrders(db, mark, id, orders);
}

export async function deleteBookmarkRecords(db: D1Database, input: { mark: string; token: string; uuids: string[] }) {
  await requireCollectionWrite(db, input.mark, input.token);
  return deleteBookmarks(db, input.mark, input.uuids);
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
  settings?: Partial<CollectionSettings>,
): Promise<{ mark: string; created: boolean; settings: CollectionSettings }> {
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
    if (settings) {
      const next = { ...rowToSettings(existing), ...settings };
      await updateCollectionSettings(db, mark, next);
      return { mark, created: false, settings: next };
    }
    return { mark, created: false, settings: rowToSettings(existing) };
  }

  const writeTokenHash = await hashWriteToken(token);
  try {
    await createCollection(db, mark, writeTokenHash, { settings });
  } catch {
    const raced = await getCollection(db, mark);
    if (!raced) {
      throw new Error("Failed to create collection");
    }
    const ok = await verifyWriteToken(token, raced.write_token_hash);
    if (!ok) {
      throw new Error("Collection already exists with a different write token");
    }
    return { mark, created: false, settings: rowToSettings(raced) };
  }

  const created = await getCollection(db, mark);
  return {
    mark,
    created: true,
    settings: created
      ? rowToSettings(created)
      : { ...DEFAULT_COLLECTION_SETTINGS, ...settings },
  };
}

export async function saveCollectionSettings(
  db: D1Database,
  mark: string,
  token: string,
  patch: Partial<CollectionSettings>,
): Promise<CollectionSettings> {
  await requireWriteAccess(db, mark, token, `settings:${mark}`);
  const existing = await getCollection(db, mark);
  if (!existing) {
    throw new Error("Collection not found");
  }
  const next: CollectionSettings = {
    ...rowToSettings(existing),
    ...patch,
    defaultCategory:
      (patch.defaultCategory ?? rowToSettings(existing).defaultCategory).trim() ||
      defaultCategory,
    homeCategory: (patch.homeCategory ?? rowToSettings(existing).homeCategory).trim(),
    homeSortProfile: (patch.homeSortProfile ?? rowToSettings(existing).homeSortProfile).trim(),
  };
  if (next.homeSortProfile && !FIXED_HOME_SORTS.has(next.homeSortProfile) && !(await sortProfileBelongsToCollection(db, mark, next.homeSortProfile))) {
    throw new Error("Sort profile not found");
  }
  await updateCollectionSettings(db, mark, next);
  return next;
}

export async function reorderCollectionBookmarks(
  db: D1Database,
  mark: string,
  token: string,
  orders: Array<{ category: string; uuids: string[] }>,
): Promise<void> {
  await requireWriteAccess(db, mark, token, `reorder:${mark}`);
  for (const order of orders) {
    const existing = await db
      .prepare("SELECT uuid FROM bookmarks WHERE mark = ? AND category = ?")
      .bind(mark, order.category)
      .all<{ uuid: string }>();
    const expected = new Set((existing.results ?? []).map((row) => row.uuid));
    if (expected.size !== order.uuids.length || order.uuids.some((uuid) => !expected.has(uuid))) {
      throw new Error("排序列表与分类收藏不匹配");
    }
  }
  for (const order of orders) await reorderBookmarks(db, mark, order.category, order.uuids);
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
    /** When omitted, uses the collection default category */
    category?: string;
    favicon?: string;
  },
): Promise<BookmarkInstance> {
  const { mark, token, url, title, description, favicon: customFavicon } =
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
      collection = await getCollection(db, mark);
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

  const settings = collection
    ? rowToSettings(collection)
    : DEFAULT_COLLECTION_SETTINGS;
  const category =
    (input.category && input.category.trim()) ||
    settings.defaultCategory ||
    defaultCategory;

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
    category,
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
  if (room <= 0 && bookmarks.length > 0) {
    throw new Error(
      `Collection already contains ${existingCount} bookmarks. The maximum is ${MAX_BOOKMARKS_PER_MARK}; delete some bookmarks before importing more.`,
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
