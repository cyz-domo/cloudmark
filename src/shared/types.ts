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
 * Server payload for the collection page, including optional one-time token issue.
 */
export interface CollectionPageData {
  bookmarksData: BookmarksData | null;
  /** True when collection exists in D1 (or demo) */
  exists: boolean;
  /** Plaintext write token issued once — client must persist it */
  issuedWriteToken?: string;
  /** Historical flag: collection was migrated from legacy storage */
  migratedFromKv?: boolean;
}

export const defaultMark = "default";
export const defaultCategory = "default";
export const isDemoMark = (mark: string) => mark === "demo";
