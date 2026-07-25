import { Hono } from "hono";
import type { Context } from "hono";
import { getCollection, rowToSettings } from "@/shared/db";
import { defaultMark, DEFAULT_COLLECTION_SETTINGS } from "@/shared/types";
import { createBookmark } from "../services/bookmarks";
import type { Env } from "../env";

/**
 * Bookmarklet entry: GET /api/add?mark=&token=&title=&url=
 * Redirects back to the collection (or shows a lightweight “saved” page)
 * according to collection settings.
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
  url.searchParams.set("message", message);
  return c.redirect(url.toString(), 302);
}

function savedPage(
  c: Context<{ Bindings: Env }>,
  opts: { mark: string; status: "success" | "error"; message: string },
) {
  const ok = opts.status === "success";
  const title = ok ? "Saved" : "Could not save";
  const detail = ok
    ? "Bookmark saved. You can close this tab."
    : opts.message.slice(0, 120);
  const collectionPath = `/${encodeURIComponent(opts.mark)}`;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} · Cloudmark</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0; min-height: 100dvh; display: grid; place-items: center;
      font: 15px/1.5 system-ui, -apple-system, sans-serif;
      background: Canvas; color: CanvasText;
    }
    .card {
      width: min(22rem, calc(100vw - 2rem));
      padding: 1.5rem 1.25rem; border-radius: 1rem;
      border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
      text-align: center;
    }
    .dot {
      width: 2.5rem; height: 2.5rem; margin: 0 auto .75rem; border-radius: 999px;
      display: grid; place-items: center; font-size: 1.1rem; font-weight: 700;
      background: ${ok ? "color-mix(in srgb, #22c55e 22%, transparent)" : "color-mix(in srgb, #ef4444 22%, transparent)"};
      color: ${ok ? "#16a34a" : "#dc2626"};
    }
    h1 { font-size: 1.1rem; margin: 0 0 .35rem; }
    p { margin: 0; opacity: .72; font-size: .9rem; }
    a { display: inline-block; margin-top: 1rem; color: inherit; opacity: .85; font-size: .85rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot" aria-hidden="true">${ok ? "OK" : "!"}</div>
    <h1>${title}</h1>
    <p>${detail.replace(/[<>&]/g, "")}</p>
    <a href="${collectionPath}">Open collection</a>
  </div>
  <script>
    try {
      if (${ok ? "true" : "false"} && history.length > 1) {
        setTimeout(function () { history.back(); }, 900);
      }
    } catch (e) {}
  </script>
</body>
</html>`;
  return c.html(html, ok ? 200 : 400);
}

function isDuplicateError(message: string): boolean {
  return /already exists/i.test(message);
}

async function finish(
  c: Context<{ Bindings: Env }>,
  mark: string,
  status: "success" | "error",
  message: string,
  redirectAfterSave: boolean,
) {
  if (redirectAfterSave) {
    return redirectWithStatus(c, mark, status, message);
  }
  return savedPage(c, { mark, status, message });
}

bookmarklet.get("/add", async (c) => {
  const mark = c.req.query("mark");
  const token = c.req.query("token");
  const title = c.req.query("title") || "Untitled";
  const url = c.req.query("url");

  let redirectAfterSave = DEFAULT_COLLECTION_SETTINGS.redirectAfterSave;

  try {
    if (!mark) {
      return redirectWithStatus(c, defaultMark, "error", "markRequired");
    }
    if (!token) {
      return finish(c, mark, "error", "tokenRequired", true);
    }
    if (!url) {
      return finish(c, mark, "error", "urlRequired", true);
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return finish(c, mark, "error", "urlRequired", true);
      }
    } catch {
      return finish(c, mark, "error", "urlRequired", true);
    }

    // Prefer existing settings (category + redirect) when collection already exists
    const existing = await getCollection(c.env.DB, mark);
    if (existing) {
      const settings = rowToSettings(existing);
      redirectAfterSave = settings.redirectAfterSave;
    }

    await createBookmark(c.env.DB, {
      mark,
      token,
      url,
      title: title.slice(0, 200),
      // category omitted → collection default
    });

    // Re-read settings after possible first-time create
    const after = await getCollection(c.env.DB, mark);
    if (after) {
      redirectAfterSave = rowToSettings(after).redirectAfterSave;
    }

    return finish(c, mark, "success", "bookmarkAdded", redirectAfterSave);
  } catch (error) {
    console.error("Error processing bookmark:", error);
    const safeMark = mark || defaultMark;
    const message =
      error instanceof Error ? error.message : "processingError";

    if (isDuplicateError(message)) {
      try {
        const col = await getCollection(c.env.DB, safeMark);
        if (col) redirectAfterSave = rowToSettings(col).redirectAfterSave;
      } catch {
        /* ignore */
      }
      return finish(c, safeMark, "success", "bookmarkExists", redirectAfterSave);
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
    return finish(c, safeMark, "error", msg, redirectAfterSave);
  }
});

export { bookmarklet };
