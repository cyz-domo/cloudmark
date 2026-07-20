import { Hono } from "hono";
import type { Context } from "hono";
import { defaultCategory, defaultMark } from "@/shared/types";
import { createBookmark } from "../services/bookmarks";
import type { Env } from "../env";

/**
 * Bookmarklet entry: GET /api/add?mark=&token=&title=&url=
 * Redirects back to the collection with status toast params.
 */
const bookmarklet = new Hono<{ Bindings: Env }>();

function redirectWithStatus(
  c: Context<{ Bindings: Env }>,
  mark: string,
  status: "success" | "error" | "warning",
  message: string,
) {
  const url = new URL(`/${mark}`, c.req.url);
  url.searchParams.set("status", status);
  // Use set() so spaces become %20 (not +) — decodeURIComponent-friendly
  url.searchParams.set("message", message);
  return c.redirect(url.toString(), 302);
}

function isDuplicateError(message: string): boolean {
  return /already exists/i.test(message);
}

bookmarklet.get("/add", async (c) => {
  const mark = c.req.query("mark");
  const token = c.req.query("token");
  const title = c.req.query("title") || "Untitled";
  const url = c.req.query("url");

  try {
    if (!mark) {
      return redirectWithStatus(c, defaultMark, "error", "markRequired");
    }
    if (!token) {
      return redirectWithStatus(c, mark, "error", "tokenRequired");
    }
    if (!url) {
      return redirectWithStatus(c, mark, "error", "urlRequired");
    }

    // Basic URL sanity — reject obvious garbage early
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return redirectWithStatus(c, mark, "error", "urlRequired");
      }
    } catch {
      return redirectWithStatus(c, mark, "error", "urlRequired");
    }

    await createBookmark(c.env.DB, {
      mark,
      token,
      url,
      title: title.slice(0, 200),
      category: defaultCategory,
    });

    return redirectWithStatus(c, mark, "success", "bookmarkAdded");
  } catch (error) {
    console.error("Error processing bookmark:", error);
    const safeMark = mark || defaultMark;
    const message =
      error instanceof Error ? error.message : "processingError";

    // Re-saving the same page is success for bookmarklets
    if (isDuplicateError(message)) {
      return redirectWithStatus(c, safeMark, "success", "bookmarkExists");
    }

    const known = [
      "markRequired",
      "urlRequired",
      "tokenRequired",
      "processingError",
      "bookmarkAdded",
      "bookmarkExists",
    ];
    const msg = known.includes(message) ? message : message.slice(0, 200);
    return redirectWithStatus(c, safeMark, "error", msg);
  }
});

export { bookmarklet };
