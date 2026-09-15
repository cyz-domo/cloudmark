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

export function parseCategories(categoryStr?: string | null): string[] {
  if (!categoryStr?.trim()) return [defaultCategory];
  const cats = categoryStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return cats.length > 0 ? cats : [defaultCategory];
}

export function serializeCategories(categories: string[]): string {
  const clean = Array.from(
    new Set(categories.map((c) => c.trim()).filter(Boolean)),
  );
  return clean.length > 0 ? clean.join(", ") : defaultCategory;
}

export function renameCategoryInMulti(
  categoryStr: string,
  from: string,
  to: string,
): string {
  const cats = parseCategories(categoryStr);
  const renamed = cats.map((cat) =>
    cat === from || cat.startsWith(`${from} / `)
      ? `${to}${cat.slice(from.length)}`
      : cat,
  );
  return serializeCategories(renamed);
}

export function removeCategoryFromMulti(
  categoryStr: string,
  catToRemove: string,
): string {
  const cats = parseCategories(categoryStr);
  const remaining = cats.filter(
    (cat) => cat !== catToRemove && !cat.startsWith(`${catToRemove} / `),
  );
  return serializeCategories(remaining);
}

export const getCategories = (bookmarksdata: BookmarksData | null) => {
  if (!bookmarksdata) {
    return [defaultCategory];
  }

  const allCats = bookmarksdata.bookmarks.flatMap((bookmark) =>
    parseCategories(bookmark.category),
  );
  const uniqueCategories = [...new Set(allCats)];

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
