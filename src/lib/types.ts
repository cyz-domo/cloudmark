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

export const defaultMark = "default";
export const defaultCategory = "default";
export const isDemoMark = (mark: string) => mark === "demo";
