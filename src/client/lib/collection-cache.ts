import type { CollectionPageData } from "@/shared/types";

const CACHE_PREFIX = "cloudmark:cache:";
const CACHE_VERSION = 1;

interface CachedCollection {
  version: number;
  savedAt: string;
  page: CollectionPageData;
}

/** Best-effort local mirror of the last known good collection state. */
export function saveCollectionCache(
  mark: string,
  page: CollectionPageData,
): void {
  try {
    const safe: CollectionPageData = {
      bookmarksData: page.bookmarksData,
      exists: page.exists,
      settings: page.settings,
      categories: page.categories,
      sortProfiles: page.sortProfiles,
      categorySorts: page.categorySorts,
    };
    const payload: CachedCollection = {
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      page: safe,
    };
    localStorage.setItem(CACHE_PREFIX + mark, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage unavailable — cache is best-effort.
  }
}

export function loadCollectionCache(
  mark: string,
): { page: CollectionPageData; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + mark);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCollection;
    if (
      parsed?.version !== CACHE_VERSION ||
      typeof parsed.savedAt !== "string" ||
      !parsed.page?.bookmarksData ||
      !Array.isArray(parsed.page.bookmarksData.bookmarks)
    ) {
      return null;
    }
    return { page: parsed.page, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}