import type { BookmarkInstance } from "./types";
import { defaultCategory } from "./types";
import {
  CATEGORY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  URL_MAX_LENGTH,
} from "./constants";

export interface ParsedBookmark {
  url: string;
  title: string;
  description?: string;
  category: string;
  /** Unix seconds if present in Netscape file */
  addDate?: number;
}

/**
 * Serialize bookmarks to Netscape Bookmark File Format (HTML).
 * Importable by Chrome, Firefox, Safari, Edge, etc.
 */
export function exportNetscapeHtml(
  bookmarks: BookmarkInstance[],
  collectionName: string,
): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const byCategory = new Map<string, BookmarkInstance[]>();
  for (const b of bookmarks) {
    const cat = b.category || defaultCategory;
    const list = byCategory.get(cat) ?? [];
    list.push(b);
    byCategory.set(cat, list);
  }

  const lines: string[] = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- This is an automatically generated file.",
    "     It will be read and overwritten.",
    "     DO NOT EDIT! -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    `<TITLE>Bookmarks — ${escape(collectionName)}</TITLE>`,
    `<H1>Bookmarks — ${escape(collectionName)}</H1>`,
    "<DL><p>",
  ];

  for (const [category, items] of [...byCategory.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    lines.push(
      `    <DT><H3>${escape(category)}</H3>`,
      "    <DL><p>",
    );
    for (const b of items) {
      const addDate = Math.floor(new Date(b.createdAt).getTime() / 1000);
      const href = escape(b.url);
      const title = escape(b.title || b.url);
      lines.push(
        `        <DT><A HREF="${href}" ADD_DATE="${addDate}">${title}</A>`,
      );
      if (b.description) {
        lines.push(`        <DD>${escape(b.description)}`);
      }
    }
    lines.push("    </DL><p>");
  }

  lines.push("</DL><p>");
  return lines.join("\n");
}

/**
 * Parse Netscape / browser bookmark HTML into flat bookmark list.
 * Folder names become categories (nested folders joined with " / ").
 */
export function parseNetscapeHtml(html: string): ParsedBookmark[] {
  const results: ParsedBookmark[] = [];
  const folderStack: string[] = [];

  // Normalize line endings; work on a simplified token stream of tags we care about
  const re =
    /<DT>\s*<H3[^>]*>([\s\S]*?)<\/H3>|<DT>\s*<A\s+([^>]+)>([\s\S]*?)<\/A>|<DD>([\s\S]*?)(?=<DT|<DL|<\/DL|$)|<\/DL>/gi;

  let lastBookmark: ParsedBookmark | null = null;
  let match: RegExpExecArray | null;

  while ((match = re.exec(html)) !== null) {
    const full = match[0];

    if (/^<\/DL>/i.test(full)) {
      folderStack.pop();
      lastBookmark = null;
      continue;
    }

    if (match[1] !== undefined && /<H3/i.test(full)) {
      const name = decodeHtml(stripTags(match[1])).trim() || "Folder";
      folderStack.push(name.slice(0, CATEGORY_MAX_LENGTH));
      lastBookmark = null;
      continue;
    }

    if (match[2] !== undefined && /<A\s/i.test(full)) {
      const attrs = match[2];
      const href = getAttr(attrs, "HREF") || getAttr(attrs, "href");
      if (!href || !/^https?:\/\//i.test(href)) {
        lastBookmark = null;
        continue;
      }
      const title = decodeHtml(stripTags(match[3] ?? "")).trim() || href;
      const addDateRaw = getAttr(attrs, "ADD_DATE") || getAttr(attrs, "add_date");
      const addDate = addDateRaw ? Number(addDateRaw) : undefined;
      const category =
        folderStack.length > 0
          ? folderStack.join(" / ").slice(0, CATEGORY_MAX_LENGTH)
          : defaultCategory;

      lastBookmark = {
        url: href.slice(0, URL_MAX_LENGTH),
        title: title.slice(0, TITLE_MAX_LENGTH),
        category,
        addDate: Number.isFinite(addDate) ? addDate : undefined,
      };
      results.push(lastBookmark);
      continue;
    }

    if (match[4] !== undefined && lastBookmark) {
      const desc = decodeHtml(stripTags(match[4])).trim();
      if (desc) {
        lastBookmark.description = desc.slice(0, DESCRIPTION_MAX_LENGTH);
      }
    }
  }

  return results;
}

/** Cloudmark JSON export shape */
export interface CloudmarkExport {
  version: 1;
  format: "cloudmark";
  mark: string;
  exportedAt: string;
  bookmarks: Array<{
    url: string;
    title: string;
    description?: string;
    category: string;
    createdAt?: string;
    favicon?: string;
  }>;
}

export function exportCloudmarkJson(
  mark: string,
  bookmarks: BookmarkInstance[],
): CloudmarkExport {
  return {
    version: 1,
    format: "cloudmark",
    mark,
    exportedAt: new Date().toISOString(),
    bookmarks: bookmarks.map((b) => ({
      url: b.url,
      title: b.title,
      description: b.description,
      category: b.category,
      createdAt: b.createdAt,
      favicon: b.favicon,
    })),
  };
}

export function parseCloudmarkJson(text: string): ParsedBookmark[] {
  const data = JSON.parse(text) as Partial<CloudmarkExport> & {
    bookmarks?: unknown;
  };
  if (!data || !Array.isArray(data.bookmarks)) {
    throw new Error("Invalid Cloudmark JSON");
  }
  const out: ParsedBookmark[] = [];
  for (const raw of data.bookmarks) {
    if (!raw || typeof raw !== "object") continue;
    const b = raw as Record<string, unknown>;
    const url = String(b.url ?? "");
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({
      url: url.slice(0, URL_MAX_LENGTH),
      title: String(b.title ?? url).slice(0, TITLE_MAX_LENGTH) || url,
      description:
        typeof b.description === "string"
          ? b.description.slice(0, DESCRIPTION_MAX_LENGTH)
          : undefined,
      category: String(b.category || defaultCategory).slice(
        0,
        CATEGORY_MAX_LENGTH,
      ),
      addDate:
        typeof b.createdAt === "string"
          ? Math.floor(new Date(b.createdAt).getTime() / 1000)
          : undefined,
    });
  }
  return out;
}

/** Auto-detect format from file content */
export function parseBookmarkFile(text: string): ParsedBookmark[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    return parseCloudmarkJson(trimmed);
  }
  if (
    /NETSCAPE-Bookmark-file/i.test(trimmed) ||
    /<DL/i.test(trimmed) ||
    /<A\s+[^>]*HREF/i.test(trimmed)
  ) {
    return parseNetscapeHtml(trimmed);
  }
  // Try JSON anyway
  try {
    return parseCloudmarkJson(trimmed);
  } catch {
    throw new Error("Unrecognized bookmark file format");
  }
}

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i");
  const m = attrs.match(re);
  if (m) return m[1];
  const re2 = new RegExp(`${name}\\s*=\\s*'([^']*)'`, "i");
  const m2 = attrs.match(re2);
  return m2 ? m2[1] : null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}
