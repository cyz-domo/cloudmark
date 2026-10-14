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
 * to POST /api/add. Afterwards the collection's redirectAfterSave preference
 * decides the destination: the collection page, or the page being bookmarked.
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

/** Shared locale pick: stored preference, else the browser language. */
const LOCALE_BOOTSTRAP = `
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
      [].forEach.call(document.querySelectorAll("[data-i18n]"), function (el) {
        var text = s[el.getAttribute("data-i18n")];
        if (text) el.textContent = text;
      });
      [].forEach.call(document.querySelectorAll("[data-i18n-placeholder]"), function (el) {
        var text = s[el.getAttribute("data-i18n-placeholder")];
        if (text) el.placeholder = text;
      });`;

/** JSON literal that cannot terminate the enclosing <script>. */
function jsonForScript(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const KNOWN_ERROR_KEYS = [
  "markRequired",
  "urlRequired",
  "tokenRequired",
  "processingError",
];

function isHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function savedPage(
  c: Context<{ Bindings: Env }>,
  opts: {
    status: "saved" | "duplicate" | "error";
    /** Saved groups on success, or the failure text. */
    detail: string;
    pageTitle: string;
    sourceUrl?: string;
  },
) {
  const ok = opts.status !== "error";
  const headingKey =
    opts.status === "saved" ? "saved" : opts.status === "duplicate" ? "duplicate" : "failed";
  const errorKey = ok || !KNOWN_ERROR_KEYS.includes(opts.detail) ? "" : opts.detail;
  const sourceUrl = isHttpUrl(opts.sourceUrl) ? opts.sourceUrl : "";
  const back = sourceUrl
    ? `<a href="${escapeHtml(sourceUrl)}" data-i18n="back">返回原网页</a>`
    : "";
  const serverTitle = ok ? "已保存 · Cloudmark" : "保存失败 · Cloudmark";
  const html = `<!doctype html>
<html lang="zh">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${serverTitle}</title>
  <style>
    :root { color-scheme: light dark; }
    body {
      margin: 0; min-height: 100dvh; display: grid; place-items: center;
      font: 15px/1.5 system-ui, -apple-system, sans-serif;
      background: Canvas; color: CanvasText;
    }
    .card {
      width: min(24rem, calc(100vw - 2rem));
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
    .page { font-size: .82rem; opacity: .8; margin: 0; word-break: break-all; }
    .groups { font-size: .78rem; opacity: .6; margin: .35rem 0 0; word-break: break-all; }
    .msg { font-size: .8rem; margin: .5rem 0 0; opacity: .85; word-break: break-word; }
    a { display: inline-block; margin-top: 1rem; color: inherit; opacity: .85; font-size: .85rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="dot" aria-hidden="true">${ok ? "OK" : "!"}</div>
    <h1 data-i18n="${headingKey}">${
      opts.status === "error" ? "保存失败" : opts.status === "duplicate" ? "已经在这些分组里" : "已保存"
    }</h1>
    <p class="page">${escapeHtml(opts.pageTitle.slice(0, 120))}</p>
    ${
      ok
        ? `${opts.detail ? `<p class="groups">${escapeHtml(opts.detail)}</p>` : ""}<p class="msg" data-i18n="returning">正在返回原网页…</p>`
        : `<p class="msg"${errorKey ? ` data-i18n-error="${errorKey}"` : ""}>${
            errorKey ? "" : escapeHtml(opts.detail.slice(0, 200))
          }</p>`
    }
    ${back}
  </div>
  <script>
    (function () {
      var STRINGS = {
        zh: {
          title: "已保存 · Cloudmark",
          titleFailed: "保存失败 · Cloudmark",
          saved: "已保存",
          duplicate: "已经在这些分组里",
          failed: "保存失败",
          returning: "正在返回原网页…",
          back: "返回原网页",
          errors: {
            markRequired: "缺少集合标识",
            urlRequired: "网页地址无效",
            tokenRequired: "缺少写入令牌",
            processingError: "保存失败，请稍后重试",
          },
        },
        en: {
          title: "Saved · Cloudmark",
          titleFailed: "Could not save · Cloudmark",
          saved: "Saved",
          duplicate: "Already in these groups",
          failed: "Could not save",
          returning: "Returning to the page…",
          back: "Back to the page",
          errors: {
            markRequired: "Missing collection mark",
            urlRequired: "Invalid page URL",
            tokenRequired: "Missing write token",
            processingError: "Could not save. Please try again later.",
          },
        },
      };${LOCALE_BOOTSTRAP}
      document.title = ${ok ? "s.title" : "s.titleFailed"};
      var err = document.querySelector("[data-i18n-error]");
      if (err) {
        var text = (s.errors || {})[err.getAttribute("data-i18n-error")];
        if (text) err.textContent = text;
      }
      ${ok ? `var src = ${jsonForScript(sourceUrl)};
      if (src) setTimeout(function () { location.replace(src); }, 700);` : ""}
    })();
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
    .new button { flex: 0 0 auto; padding-left: .85rem; padding-right: .85rem; }
    .row { display: flex; flex-wrap: wrap; gap: .5rem; }
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
      <button type="button" id="add" data-i18n="add">添加</button>
    </div>
    <input type="hidden" name="category" id="out" />
    <input type="hidden" name="mark" value="${escapeHtml(input.mark)}" />
    <input type="hidden" name="token" value="${escapeHtml(input.token)}" />
    <input type="hidden" name="title" value="${escapeHtml(input.title)}" />
    <input type="hidden" name="url" value="${escapeHtml(input.url)}" />
    <div class="row">
      <button type="submit" id="save" class="primary" disabled data-i18n="save">保存</button>
      <button type="button" id="fallback" data-i18n="fallback">默认分组</button>
      <button type="button" id="cancel" data-i18n="cancel">取消</button>
    </div>
    <p class="hint" data-i18n="hint">可多选；新建分组点“添加”或按回车。</p>
  </form>
  <script>
    (function () {
      var STRINGS = {
        zh: {
          title: "选择分组 · Cloudmark",
          heading: "保存到分组",
          search: "搜索分组…",
          newGroup: "新建分组名",
          add: "添加",
          save: "保存",
          fallback: "默认分组",
          cancel: "取消",
          hint: "可多选；新建分组点“添加”或按回车。",
          empty: "未找到匹配分组",
        },
        en: {
          title: "Choose a group · Cloudmark",
          heading: "Save to a group",
          search: "Search groups…",
          newGroup: "New group name",
          add: "Add",
          save: "Save",
          fallback: "Default group",
          cancel: "Cancel",
          hint: "Pick several if needed; click Add or press Enter to create a group.",
          empty: "No matching groups",
        },
      };${LOCALE_BOOTSTRAP}
      document.title = s.title;

      var def = ${jsonForScript(defaultCategory)};
      var src = ${jsonForScript(input.url)};
      var list = document.getElementById("list");
      var out = document.getElementById("out");
      var save = document.getElementById("save");
      var chips = [].slice.call(list.querySelectorAll(".chip"));
      var storeKey = ${jsonForScript(`cloudmark:picker:${input.mark}`)};
      var remembered = [];
      try {
        remembered = JSON.parse(localStorage.getItem(storeKey) || "[]");
      } catch (e) {}

      function pendingName() {
        return document.getElementById("new").value.trim().slice(0, 50);
      }

      function sync() {
        var picked = chips
          .filter(function (el) { return el.querySelector("input").checked; })
          .map(function (el) { return el.querySelector("input").value; });
        out.value = picked.join(", ");
        save.disabled = picked.length === 0 && !pendingName();
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

      var newBox = document.getElementById("new");

      function addNew() {
        var name = newBox.value.trim().slice(0, 50);
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
        newBox.value = "";
        search.value = "";
        applyFilter();
        sync();
      }

      document.getElementById("add").addEventListener("click", addNew);
      newBox.addEventListener("input", sync);
      newBox.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          addNew();
        }
      });

      // Runs before the form is serialized, so a name typed without clicking
      // Add is still saved.
      document.getElementById("f").addEventListener("submit", function () {
        addNew();
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

      document.getElementById("cancel").addEventListener("click", function () {
        if (history.length > 1) {
          history.back();
        } else {
          location.replace(src);
        }
      });

      sync();
    })();
  </script>
</body>
</html>`;
  return c.html(html);
}

/** One collection preference drives the whole response: where to go after a save. */
async function prefersRedirect(c: Context<{ Bindings: Env }>, mark: string): Promise<boolean> {
  if (!mark) return DEFAULT_COLLECTION_SETTINGS.redirectAfterSave;
  const row = await getCollection(c.env.DB, mark);
  return row
    ? rowToSettings(row).redirectAfterSave
    : DEFAULT_COLLECTION_SETTINGS.redirectAfterSave;
}

interface Outcome {
  mark: string;
  title: string;
  url?: string;
  status: "saved" | "duplicate" | "error";
  /** Groups shown on the confirmation page. */
  detail: string;
  /** Toast key (or raw text) used when jumping to the collection page. */
  toast: string;
}

async function respond(c: Context<{ Bindings: Env }>, outcome: Outcome) {
  if (await prefersRedirect(c, outcome.mark)) {
    return redirectWithStatus(
      c,
      outcome.mark,
      outcome.status === "error" ? "error" : "success",
      outcome.toast,
    );
  }
  return savedPage(c, {
    status: outcome.status,
    detail: outcome.detail,
    pageTitle: outcome.title,
    sourceUrl: outcome.url,
  });
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
  const base = { mark: input.mark, title: input.title, url: input.url };

  try {
    const bookmark = await createBookmark(c.env.DB, {
      ...base,
      token: input.token,
      title: input.title.slice(0, 200),
      category: input.category,
    });

    return respond(c, {
      ...base,
      status: "saved",
      detail: bookmark.category,
      toast: "bookmarkAdded",
    });
  } catch (error) {
    console.error("Error processing bookmark:", error);
    const message = error instanceof Error ? error.message : "processingError";

    if (isDuplicateError(message)) {
      return respond(c, {
        ...base,
        status: "duplicate",
        detail: input.category ?? "",
        toast: "bookmarkExists",
      });
    }

    const detail = KNOWN_ERROR_KEYS.includes(message) ? message : message.slice(0, 200);
    return respond(c, { ...base, status: "error", detail, toast: detail });
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
    if (input.error === "markRequired") {
      return redirectWithStatus(c, defaultMark, "error", input.error);
    }
    return respond(c, {
      mark: c.req.query("mark") || defaultMark,
      title: c.req.query("title") || "Untitled",
      url: c.req.query("url"),
      status: "error",
      detail: input.error,
      toast: input.error,
    });
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
    return respond(c, {
      mark: get("mark") || defaultMark,
      title: get("title") || "Untitled",
      url: get("url"),
      status: "error",
      detail: input.error,
      toast: input.error,
    });
  }
  return saveBookmark(c, input);
});

export { bookmarklet };
