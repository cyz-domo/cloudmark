import { Hono } from "hono";
import type { Context } from "hono";
import {
  getCollection,
  rowToSettings,
  getCategoryOrder,
  getBookmarksForMark,
} from "@/shared/db";
import { defaultMark, DEFAULT_COLLECTION_SETTINGS } from "@/shared/types";
import { CATEGORY_MAX_LENGTH, SINGLE_CATEGORY_MAX_LENGTH } from "@/shared/constants";
import { parseCategories, serializeCategories } from "@/shared/utils";
import { createBookmark } from "../services/bookmarks";
import type { Env } from "../env";

/**
 * Bookmarklet entry: GET /api/add?mark=&token=&title=&url=
 * Without a `category` it renders a group picker, which posts the choice back
 * to POST /api/add. Once the bookmark is written it redirects back to the
 * collection (or shows a lightweight "saved" page) per collection settings.
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Categories available for a collection, in the user's preferred order. */
async function listCategories(
  c: Context<{ Bindings: Env }>,
  mark: string,
): Promise<{ categories: string[]; defaultCategory: string }> {
  const collection = await getCollection(c.env.DB, mark);
  const defaultCategory = collection
    ? rowToSettings(collection).defaultCategory
    : DEFAULT_COLLECTION_SETTINGS.defaultCategory;
  if (!collection) {
    return { categories: [defaultCategory], defaultCategory };
  }
  const bookmarks = await getBookmarksForMark(c.env.DB, mark);
  const saved = getCategoryOrder(collection);
  const discovered = [
    ...new Set(bookmarks.flatMap((bookmark) => parseCategories(bookmark.category))),
  ];
  const categories = [
    ...new Set([...saved, ...discovered.filter((item) => !saved.includes(item))]),
  ];
  if (!categories.includes(defaultCategory)) {
    categories.unshift(defaultCategory);
  }
  return { categories, defaultCategory };
}

/**
 * Intermediate page shown when the bookmarklet has not chosen a group yet:
 * pick one or more existing categories, or type a new one, then save.
 */
async function pickerPage(c: Context<{ Bindings: Env }>, input: SaveInput) {
  const { categories, defaultCategory } = await listCategories(c, input.mark);
  const lastKey = JSON.stringify(`cloudmark:picker:${input.mark}`);
  const html = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>选择分组 · Cloudmark</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0; min-height: 100dvh; display: grid; place-items: center;
      font: 15px/1.5 system-ui, -apple-system, sans-serif;
      background: Canvas; color: CanvasText;
    }
    .card {
      width: min(26rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      overflow: auto;
      padding: 1.25rem; border-radius: 1rem;
      border: 1px solid color-mix(in srgb, CanvasText 12%, transparent);
    }
    h1 { font-size: 1rem; margin: 0 0 .25rem; }
    .page { font-size: .8rem; opacity: .7; margin: 0 0 1rem; word-break: break-all; }
    input[type=search], input[type=text] {
      width: 100%; box-sizing: border-box; padding: .5rem .6rem;
      font: inherit; font-size: .85rem; border-radius: .5rem;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      background: Canvas; color: CanvasText;
    }
    .list { margin: .75rem 0; display: flex; flex-wrap: wrap; gap: .4rem; }
    .chip {
      display: inline-flex; align-items: center; gap: .3rem;
      padding: .35rem .6rem; border-radius: 999px; font-size: .8rem; cursor: pointer;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      background: color-mix(in srgb, CanvasText 5%, transparent);
    }
    .chip.on {
      border-color: #2563eb; color: #2563eb; font-weight: 600;
      background: color-mix(in srgb, #2563eb 16%, transparent);
    }
    .chip.hidden { display: none; }
    .new { display: flex; gap: .4rem; margin-bottom: 1rem; }
    .row { display: flex; gap: .5rem; }
    button {
      flex: 1; padding: .55rem .6rem; font: inherit; font-size: .85rem;
      border-radius: .5rem; cursor: pointer;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      background: Canvas; color: CanvasText;
    }
    button.primary { background: #2563eb; border-color: #2563eb; color: #fff; font-weight: 600; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .hint { font-size: .72rem; opacity: .6; margin: .75rem 0 0; }
    .empty { font-size: .75rem; opacity: .55; margin: .25rem 0 .75rem; }
  </style>
</head>
<body>
  <form class="card" method="post" action="/api/add" id="f">
    <h1 data-i18n="heading">保存到分组</h1>
    <p class="page">${escapeHtml(input.title.slice(0, 120))}<br />${escapeHtml(input.url.slice(0, 160))}</p>
    <input type="search" id="q" placeholder="搜索分组…" data-i18n-placeholder="search" autocomplete="off" />
    <div class="list" id="list">${categories
      .map(
        (cat) =>
          `<label class="chip" data-name="${escapeHtml(cat.toLowerCase())}"><input type="checkbox" name="cat" value="${escapeHtml(cat)}" hidden /><span>${escapeHtml(cat)}</span></label>`,
      )
      .join("")}</div>
    <p class="empty" id="empty" data-i18n="empty" hidden>未找到匹配分组</p>
    <div class="new">
      <input type="text" id="new" placeholder="新建分组名" data-i18n-placeholder="newGroup" maxlength="50" autocomplete="off" />
    </div>
    <input type="hidden" name="category" id="out" />
    <input type="hidden" name="mark" value="${escapeHtml(input.mark)}" />
    <input type="hidden" name="token" value="${escapeHtml(input.token)}" />
    <input type="hidden" name="title" value="${escapeHtml(input.title)}" />
    <input type="hidden" name="url" value="${escapeHtml(input.url)}" />
    <div class="row">
      <button type="submit" id="save" class="primary" disabled data-i18n="save">保存</button>
      <button type="button" id="fallback" data-i18n="fallback">默认分组</button>
    </div>
    <p class="hint" data-i18n="hint">可多选；新建分组按回车添加。</p>
  </form>
  <script>
    (function () {
      var STRINGS = {
        zh: {
          title: "选择分组 · Cloudmark",
          heading: "保存到分组",
          search: "搜索分组…",
          newGroup: "新建分组名",
          save: "保存",
          fallback: "默认分组",
          hint: "可多选；新建分组按回车添加。",
          empty: "未找到匹配分组",
        },
        en: {
          title: "Choose a group · Cloudmark",
          heading: "Save to a group",
          search: "Search groups…",
          newGroup: "New group name",
          save: "Save",
          fallback: "Default group",
          hint: "Pick several if needed; press Enter to add a group.",
          empty: "No matching groups",
        },
      };
      var stored = "";
      try {
        stored = localStorage.getItem("cloudmark:locale");
      } catch (e) {}
      var locale =
        stored === "en" || stored === "zh"
          ? stored
          : ((navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en");
      var s = STRINGS[locale];
      document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
      document.title = s.title;
      [].forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
        var text = s[el.getAttribute("data-i18n")];
        if (text) el.textContent = text;
      });
      [].forEach.call(document.querySelectorAll("[data-i18n-placeholder]"), function (el) {
        var text = s[el.getAttribute("data-i18n-placeholder")];
        if (text) el.placeholder = text;
      });

      var def = ${JSON.stringify(defaultCategory)};
      var list = document.getElementById("list");
      var out = document.getElementById("out");
      var save = document.getElementById("save");
      var chips = [].slice.call(list.querySelectorAll(".chip"));
      var storeKey = ${lastKey};
      var remembered = [];
      try {
        remembered = JSON.parse(localStorage.getItem(storeKey) || "[]");
      } catch (e) {}

      function sync() {
        var picked = chips
          .filter(function (el) { return el.querySelector("input").checked; })
          .map(function (el) { return el.querySelector("input").value; });
        out.value = picked.join(", ");
        save.disabled = picked.length === 0;
        try { localStorage.setItem(storeKey, JSON.stringify(picked)); } catch (e) {}
      }

      var anyChecked = false;
      chips.forEach(function (el) {
        var box = el.querySelector("input");
        var name = box.value;
        if (remembered.length ? remembered.indexOf(name) > -1 : name === def) {
          box.checked = true;
          el.classList.add("on");
          anyChecked = true;
        }
        el.addEventListener("click", function (ev) {
          ev.preventDefault();
          box.checked = !box.checked;
          el.classList.toggle("on", box.checked);
          sync();
        });
      });

      // Remembered groups can be renamed or deleted since the last save
      if (!anyChecked) {
        chips.forEach(function (el) {
          var box = el.querySelector("input");
          if (box.value !== def) return;
          box.checked = true;
          el.classList.add("on");
        });
      }

      var search = document.getElementById("q");
      var empty = document.getElementById("empty");

      function applyFilter() {
        var term = search.value.trim().toLowerCase();
        var shown = 0;
        chips.forEach(function (el) {
          var match = !term || el.dataset.name.indexOf(term) > -1;
          el.classList.toggle("hidden", !match);
          if (match) shown += 1;
        });
        empty.hidden = shown > 0;
      }

      search.addEventListener("input", applyFilter);

      function addNew() {
        var box = document.getElementById("new");
        var name = box.value.trim().slice(0, 50);
        if (!name) return;
        var lower = name.toLowerCase();
        var hit = chips.filter(function (el) { return el.dataset.name === lower; })[0];
        if (!hit) {
          var label = document.createElement("label");
          label.className = "chip";
          label.dataset.name = lower;
          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.name = "cat";
          cb.value = name;
          cb.hidden = true;
          cb.checked = true;
          var span = document.createElement("span");
          span.textContent = name;
          label.appendChild(cb);
          label.appendChild(span);
          label.classList.add("on");
          label.addEventListener("click", function (ev) {
            ev.preventDefault();
            cb.checked = !cb.checked;
            label.classList.toggle("on", cb.checked);
            sync();
          });
          list.appendChild(label);
          chips.push(label);
        } else {
          var input = hit.querySelector("input");
          input.checked = true;
          hit.classList.add("on");
        }
        box.value = "";
        search.value = "";
        applyFilter();
        sync();
      }

      document.getElementById("new").addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          addNew();
        }
      });

      document.getElementById("fallback").addEventListener("click", function () {
        var target = chips.filter(function (el) { return el.querySelector("input").value === def; })[0];
        out.value = def;
        if (target) {
          var box = target.querySelector("input");
          box.checked = true;
          target.classList.add("on");
        }
        document.getElementById("f").submit();
      });

      sync();
    })();
  </script>
</body>
</html>`;
  return c.html(html);
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

/** Collected input for one bookmarklet save. */
interface SaveInput {
  mark: string;
  token: string;
  title: string;
  url: string;
  /** Omit to fall back to the collection default category. */
  category?: string;
}

async function saveBookmark(c: Context<{ Bindings: Env }>, input: SaveInput) {
  let redirectAfterSave = DEFAULT_COLLECTION_SETTINGS.redirectAfterSave;

  try {
    // Prefer existing settings when the collection already exists
    const existing = await getCollection(c.env.DB, input.mark);
    if (existing) {
      redirectAfterSave = rowToSettings(existing).redirectAfterSave;
    }

    await createBookmark(c.env.DB, {
      mark: input.mark,
      token: input.token,
      url: input.url,
      title: input.title.slice(0, 200),
      category: input.category,
    });

    // Re-read settings after possible first-time create
    const after = await getCollection(c.env.DB, input.mark);
    if (after) {
      redirectAfterSave = rowToSettings(after).redirectAfterSave;
    }

    return finish(c, input.mark, "success", "bookmarkAdded", redirectAfterSave);
  } catch (error) {
    console.error("Error processing bookmark:", error);
    const safeMark = input.mark || defaultMark;
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
}

/** Multi-category strings arrive comma-joined from the picker page. */
function normalizeCategory(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  const parts: string[] = [];
  let used = 0;
  for (const item of value.split(",")) {
    const category = item.trim().slice(0, SINGLE_CATEGORY_MAX_LENGTH);
    if (!category || parts.includes(category)) continue;
    // Leave room for the ", " separator enforced by the total limit.
    if (used + category.length + 2 > CATEGORY_MAX_LENGTH) break;
    parts.push(category);
    used += category.length + 2;
  }
  return parts.length > 0 ? serializeCategories(parts) : undefined;
}

/** Shared entry validation; returns the error response or the normalized input. */
function readSaveInput(raw: {
  mark?: string;
  token?: string;
  title?: string;
  url?: string;
  category?: string;
}): { error: string } | SaveInput {
  const { mark, token, url } = raw;
  if (!mark) return { error: "markRequired" };
  if (!token) return { error: "tokenRequired" };
  if (!url) return { error: "urlRequired" };
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "urlRequired" };
    }
  } catch {
    return { error: "urlRequired" };
  }
  return {
    mark,
    token,
    url,
    title: raw.title || "Untitled",
    category: normalizeCategory(raw.category),
  };
}

bookmarklet.get("/add", async (c) => {
  const input = readSaveInput({
    mark: c.req.query("mark"),
    token: c.req.query("token"),
    title: c.req.query("title"),
    url: c.req.query("url"),
    category: c.req.query("category"),
  });
  if ("error" in input) {
    const safeMark = c.req.query("mark") || defaultMark;
    if (input.error === "markRequired") {
      return redirectWithStatus(c, defaultMark, "error", input.error);
    }
    return finish(c, safeMark, "error", input.error, true);
  }

  // No category chosen yet → ask which group to file this under
  if (!input.category) {
    return pickerPage(c, input);
  }

  return saveBookmark(c, input);
});

bookmarklet.post("/add", async (c) => {
  const form = await c.req.formData();
  const get = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : undefined;
  };
  const input = readSaveInput({
    mark: get("mark"),
    token: get("token"),
    title: get("title"),
    url: get("url"),
    category: get("category"),
  });
  if ("error" in input) {
    return finish(c, get("mark") || defaultMark, "error", input.error, true);
  }
  return saveBookmark(c, input);
});

export { bookmarklet };
