import type {
  BookmarkInstance,
  CollectionPageData,
} from "@/shared/types";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`,
    );
  }
  return data;
}

export async function fetchCollection(
  mark: string,
): Promise<CollectionPageData> {
  const res = await fetch(`/api/collections/${encodeURIComponent(mark)}`);
  return parseJson<CollectionPageData>(res);
}

export async function createBookmarkApi(input: {
  mark: string;
  token: string;
  url: string;
  title: string;
  description?: string;
  category: string;
}): Promise<BookmarkInstance> {
  const res = await fetch("/api/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<BookmarkInstance>(res);
}

export async function updateBookmarkApi(input: {
  mark: string;
  token: string;
  uuid: string;
  url: string;
  title: string;
  description?: string;
  category: string;
}): Promise<BookmarkInstance> {
  const res = await fetch(`/api/bookmarks/${encodeURIComponent(input.uuid)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<BookmarkInstance>(res);
}

export async function deleteBookmarkApi(input: {
  mark: string;
  token: string;
  uuid: string;
}): Promise<void> {
  const res = await fetch(`/api/bookmarks/${encodeURIComponent(input.uuid)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseJson<{ ok: boolean }>(res);
}

export async function regenerateTokenApi(input: {
  mark: string;
  currentToken: string;
  newToken: string;
}): Promise<{ mark: string; token: string }> {
  const res = await fetch("/api/collections/regenerate-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<{ mark: string; token: string }>(res);
}

export interface ImportApiResult {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
  bookmarks: BookmarkInstance[];
}

export async function importBookmarksApi(input: {
  mark: string;
  token: string;
  bookmarks: Array<{
    url: string;
    title: string;
    description?: string;
    category: string;
    createdAt?: string;
  }>;
  skipDuplicates?: boolean;
}): Promise<ImportApiResult> {
  const res = await fetch("/api/bookmarks/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<ImportApiResult>(res);
}
