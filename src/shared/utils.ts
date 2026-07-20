import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { type BookmarksData, defaultCategory } from "./types";
import { generateSecureMark } from "./security";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated Prefer generateSecureMark from security */
export const generateRandomMark = () => generateSecureMark();

export const getBaseUrl = () => {
  const loc = (globalThis as unknown as { location?: { origin?: string } })
    .location;
  if (loc?.origin) {
    return loc.origin;
  }
  return "http://localhost:3000";
};

export const getCategories = (bookmarksdata: BookmarksData | null) => {
  if (!bookmarksdata) {
    return [defaultCategory];
  }

  const uniqueCategories = [
    ...new Set(bookmarksdata.bookmarks.map((bookmark) => bookmark.category)),
  ];

  if (!uniqueCategories.includes(defaultCategory)) {
    return [defaultCategory, ...uniqueCategories];
  }

  return [
    defaultCategory,
    ...uniqueCategories.filter((category) => category !== defaultCategory),
  ];
};

export const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
