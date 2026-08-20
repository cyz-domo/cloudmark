import { useCallback, useMemo, useState } from "react";
import type { BookmarkInstance, SortProfile } from "@/shared/types";
import { getDomain } from "@/shared/utils";

/** Sortable columns in the bookmark table */
export type SortColumn = "title" | "category" | "date" | "url" | "manual";
export type SortDir = "asc" | "desc";

/** @deprecated Prefer SortColumn + SortDir — kept for toolbar Select values */
export type SortKey = "newest" | "oldest" | "title" | "category" | "title-desc" | "category-desc" | "url" | "url-desc" | "manual";

export const ALL_CATEGORIES = "__all__";

export function isCategoryInTree(category: string, parent: string): boolean {
  return category === parent || category.startsWith(`${parent} / `);
}

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

function compareTitle(a: BookmarkInstance, b: BookmarkInstance): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

function compareCategory(a: BookmarkInstance, b: BookmarkInstance): number {
  const c = a.category.localeCompare(b.category, undefined, {
    sensitivity: "base",
  });
  return c !== 0 ? c : compareTitle(a, b);
}

function compareDate(a: BookmarkInstance, b: BookmarkInstance): number {
  return (
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function compareUrl(a: BookmarkInstance, b: BookmarkInstance): number {
  const da = getDomain(a.url);
  const db = getDomain(b.url);
  const c = da.localeCompare(db, undefined, { sensitivity: "base" });
  return c !== 0 ? c : compareTitle(a, b);
}

function sortBookmarks(
  list: BookmarkInstance[],
  column: SortColumn,
  dir: SortDir,
): BookmarkInstance[] {
  const copy = [...list];
  const mul = dir === "asc" ? 1 : -1;
  copy.sort((a, b) => {
    let cmp = 0;
    switch (column) {
      case "manual":
        cmp = 0;
        break;
      case "title":
        cmp = compareTitle(a, b);
        break;
      case "category":
        cmp = compareCategory(a, b);
        break;
      case "date":
        cmp = compareDate(a, b);
        break;
      case "url":
        cmp = compareUrl(a, b);
        break;
    }
    return cmp * mul;
  });
  return copy;
}

/** Map legacy select value → column + dir */
export function sortKeyToState(key: SortKey): {
  column: SortColumn;
  dir: SortDir;
} {
  switch (key) {
    case "newest":
      return { column: "date", dir: "desc" };
    case "oldest":
      return { column: "date", dir: "asc" };
    case "title":
      return { column: "title", dir: "asc" };
    case "title-desc":
      return { column: "title", dir: "desc" };
    case "category":
      return { column: "category", dir: "asc" };
    case "category-desc":
      return { column: "category", dir: "desc" };
    case "url":
      return { column: "url", dir: "asc" };
    case "url-desc":
      return { column: "url", dir: "desc" };
    case "manual":
      return { column: "manual", dir: "asc" };
    default:
      return { column: "date", dir: "desc" };
  }
}

export function stateToSortKey(column: SortColumn, dir: SortDir): SortKey {
  if (column === "manual") return "manual";
  if (column === "date") return dir === "desc" ? "newest" : "oldest";
  if (column === "title") return dir === "asc" ? "title" : "title-desc";
  if (column === "category")
    return dir === "asc" ? "category" : "category-desc";
  return dir === "asc" ? "url" : "url-desc";
}

/** Default direction when first clicking a column */
export function defaultDirForColumn(column: SortColumn): SortDir {
  return column === "date" ? "desc" : "asc";
}

export function useBookmarkFilter(
  bookmarks: BookmarkInstance[],
  categoryOrder: string[] = [],
  options?: { groupSorts?: Record<string, string>; profiles?: SortProfile[] },
) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookmarks) {
      map.set(b.category, (map.get(b.category) ?? 0) + 1);
    }
    return map;
  }, [bookmarks]);

  const categories = useMemo(() => {
    const discovered = [...categoryCounts.keys()];
    const ordered = [...new Set(categoryOrder)];
    return [
      ...ordered,
      ...discovered
        .filter((category) => !ordered.includes(category))
        .sort((a, b) => a.localeCompare(b)),
    ];
  }, [categoryCounts, categoryOrder]);

  const filtered = useMemo(() => {
    let list = bookmarks;
    if (category !== ALL_CATEGORIES) {
      list = list.filter((b) => isCategoryInTree(b.category, category));
    }
    if (query.trim()) {
      list = list.filter((b) => matchesQuery(b, query));
    }
    // In the all-categories view each group applies its own remembered sort.
    if (
      category === ALL_CATEGORIES &&
      options?.groupSorts &&
      Object.keys(options.groupSorts).length > 0
    ) {
      const byGroup = new Map<string, BookmarkInstance[]>();
      for (const b of list) {
        const arr = byGroup.get(b.category) ?? [];
        arr.push(b);
        byGroup.set(b.category, arr);
      }
      const orderedKeys = [
        ...categoryOrder.filter((key) => byGroup.has(key)),
        ...[...byGroup.keys()]
          .filter((key) => !categoryOrder.includes(key))
          .sort((a, b) => a.localeCompare(b)),
      ];
      const out: BookmarkInstance[] = [];
      for (const cat of orderedKeys) {
        const items = byGroup.get(cat) ?? [];
        const allFallback = options.groupSorts[ALL_CATEGORIES];
        out.push(...sortGroup(items, options.groupSorts[cat] ?? allFallback, options.profiles ?? []));
      }
      return out;
    }
    return sortBookmarks(list, sortColumn, sortDir);
  }, [bookmarks, category, query, sortColumn, sortDir, categoryOrder, options?.groupSorts, options?.profiles]);

  const sort = stateToSortKey(sortColumn, sortDir);

  const setSort = useCallback((key: SortKey) => {
    const next = sortKeyToState(key);
    setSortColumn(next.column);
    setSortDir(next.dir);
  }, []);

  /** Click a column header: same column toggles dir; new column uses default dir */
  const toggleSortColumn = useCallback((column: SortColumn) => {
    setSortColumn((prevCol) => {
      if (prevCol === column) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevCol;
      }
      setSortDir(defaultDirForColumn(column));
      return column;
    });
  }, []);

  return {
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    sortColumn,
    sortDir,
    setSortColumn,
    setSortDir,
    toggleSortColumn,
    categories,
    categoryCounts,
    filtered,
    total: bookmarks.length,
  };
}

function sortGroup(
  items: BookmarkInstance[],
  value: string | undefined,
  profiles: SortProfile[],
): BookmarkInstance[] {
  const profile = profiles.find((p) => p.id === value);
  if (profile) {
    const order = new Map(
      profile.orders.flatMap(({ uuids }, categoryIndex) =>
        uuids.map((uuid, itemIndex) => [uuid, categoryIndex * 10000 + itemIndex] as const),
      ),
    );
    return [...items].sort(
      (a, b) =>
        (order.get(a.uuid) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.uuid) ?? Number.MAX_SAFE_INTEGER),
    );
  }
  if (value && FIXED_KEYS.has(value)) {
    const { column, dir } = sortKeyToState(value as SortKey);
    return sortBookmarks(items, column, dir);
  }
  return sortBookmarks(items, "date", "desc");
}

const FIXED_KEYS = new Set(["newest", "oldest", "title", "title-desc", "category", "category-desc", "url", "url-desc", "manual"]);
