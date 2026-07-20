import { useMemo, useState } from "react";
import type { BookmarkInstance } from "@/shared/types";
import { getDomain } from "@/shared/utils";

export type SortKey = "newest" | "oldest" | "title" | "category";

export const ALL_CATEGORIES = "__all__";

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Simple multi-token AND match across title, url, domain, description, category */
export function matchesQuery(bookmark: BookmarkInstance, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hay = normalize(
    [
      bookmark.title,
      bookmark.url,
      getDomain(bookmark.url),
      bookmark.description ?? "",
      bookmark.category,
    ].join(" "),
  );
  return tokens.every((t) => hay.includes(t));
}

function sortBookmarks(
  list: BookmarkInstance[],
  sort: SortKey,
): BookmarkInstance[] {
  const copy = [...list];
  switch (sort) {
    case "newest":
      return copy.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    case "oldest":
      return copy.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    case "title":
      return copy.sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
      );
    case "category":
      return copy.sort((a, b) => {
        const c = a.category.localeCompare(b.category, undefined, {
          sensitivity: "base",
        });
        return c !== 0
          ? c
          : a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
      });
    default:
      return copy;
  }
}

export function useBookmarkFilter(bookmarks: BookmarkInstance[]) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [sort, setSort] = useState<SortKey>("newest");

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookmarks) {
      map.set(b.category, (map.get(b.category) ?? 0) + 1);
    }
    return map;
  }, [bookmarks]);

  const categories = useMemo(() => {
    return [...categoryCounts.keys()].sort((a, b) => a.localeCompare(b));
  }, [categoryCounts]);

  const filtered = useMemo(() => {
    let list = bookmarks;
    if (category !== ALL_CATEGORIES) {
      list = list.filter((b) => b.category === category);
    }
    if (query.trim()) {
      list = list.filter((b) => matchesQuery(b, query));
    }
    return sortBookmarks(list, sort);
  }, [bookmarks, category, query, sort]);

  return {
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    categories,
    categoryCounts,
    filtered,
    total: bookmarks.length,
  };
}
