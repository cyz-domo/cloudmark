export interface BookmarkInstance {
  uuid: string;
  url: string;
  title: string;
  favicon?: string;
  createdAt: string;
  modifiedAt: string;
  category: string;
  description?: string;
}

export interface BookmarksData {
  mark: string;
  bookmarks: BookmarkInstance[];
}

/**
 * Server payload for the collection page, including optional one-time token issue
 * after KV migration or collection creation.
 */
export interface CollectionPageData {
  bookmarksData: BookmarksData | null;
  /** True when collection exists in D1 (or demo) */
  exists: boolean;
  /** Plaintext write token issued once (migration / claim) — client must persist it */
  issuedWriteToken?: string;
  /** Collection was just migrated from legacy KV */
  migratedFromKv?: boolean;
}

export const defaultMark = "default";
export const defaultCategory = "default";
export const isDemoMark = (mark: string) => mark === "demo";
