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

/** Per-collection preferences */
export interface CollectionSettings {
  /** After bookmarklet save, jump to the collection page */
  redirectAfterSave: boolean;
  /** Category applied to bookmarklet saves */
  defaultCategory: string;
  homeCategory: string;
  /** Named sort profile used on the collection home page; empty means fixed default sort */
  homeSortProfile: string;
  /** If false, only viewers with the write token can open the collection */
  isPublic: boolean;
  /** Optional external image URL used as the collection background */
  backgroundUrl: string;
}

export const DEFAULT_COLLECTION_SETTINGS: CollectionSettings = {
  redirectAfterSave: true,
  defaultCategory: "default",
  homeCategory: "",
  homeSortProfile: "",
  isPublic: true,
  backgroundUrl: "",
};

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
  /** Collection preferences (defaults when collection not yet created) */
  settings?: CollectionSettings;
  /** True when collection is private and the request lacked a valid token */
  privateLocked?: boolean;
  /** Categories in the user's preferred order. */
  categories?: string[];
  sortProfiles?: SortProfile[];
}

export interface SortProfile {
  id: string;
  name: string;
  orders: Array<{ category: string; uuids: string[] }>;
}

export const defaultMark = "default";
export const defaultCategory = "default";
export const isDemoMark = (mark: string) => mark === "demo";
