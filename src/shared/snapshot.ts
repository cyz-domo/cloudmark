import type { BookmarkInstance } from "./types";

export interface SnapshotOptions {
  mark: string;
  bookmarks: BookmarkInstance[];
  /** Category names in the user's preferred order */
  categories?: string[];
  locale?: "zh" | "en";
}

interface SnapshotPayload {
  mark: string;
  exportedAt: string;
  locale: "zh" | "en";
  categories: string[];
  bookmarks: Array<{
    url: string;
    title: string;
    description?: string;
    category: string;
    favicon?: string;
    createdAt: string;
  }>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build a fully self-contained HTML snapshot: embedded data + inline
 * styles/script, no external requests. Opens from file:// and works offline.
 */
export function exportSnapshotHtml(options: SnapshotOptions): string {
  const { mark, bookmarks, categories = [], locale = "zh" } = options;
  const payload: SnapshotPayload = {
    mark,
    exportedAt: new Date().toISOString(),
    locale,
    categories,
    bookmarks: bookmarks.map((b) => ({
      url: b.url,
      title: b.title,
      description: b.description,
      category: b.category,
      favicon: b.favicon,
      createdAt: b.createdAt,
    })),
  };
  // \u003c keeps embedded JSON from ever closing the script tag
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  const title = escapeHtml(`Cloudmark · ${mark}`);

  return `<!DOCTYPE html>
<html lang="${locale === "zh" ? "zh-CN" : "en"}" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
:root{--bg:#f6f7f9;--card:#ffffff;--fg:#0f172a;--muted:#64748b;--border:#e2e8f0;--accent:#2563eb;--hover:#f1f5f9;--chip:#eef2f7}
[data-theme="dark"]{--bg:#0b1220;--card:#111a2e;--fg:#e2e8f0;--muted:#8ea0b8;--border:#24304a;--accent:#60a5fa;--hover:#1a2540;--chip:#1c2942}
@media (prefers-color-scheme: dark){[data-theme="auto"]{--bg:#0b1220;--card:#111a2e;--fg:#e2e8f0;--muted:#8ea0b8;--border:#24304a;--accent:#60a5fa;--hover:#1a2540;--chip:#1c2942}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
header{position:sticky;top:0;z-index:10;background:var(--card);border-bottom:1px solid var(--border);padding:14px 16px 10px}
.wrap{max-width:960px;margin:0 auto}
.top{display:flex;align-items:center;justify-content:space-between;gap:8px}
h1{margin:0;font-size:17px;font-weight:650;letter-spacing:-.01em}
h1 .mark{color:var(--muted);font-weight:400;font-family:ui-monospace,Consolas,monospace;font-size:14px}
#theme{border:1px solid var(--border);background:transparent;color:var(--fg);border-radius:8px;padding:4px 10px;cursor:pointer;font-size:13px}
#theme:hover{background:var(--hover)}
.meta{margin:4px 0 10px;font-size:12px;color:var(--muted)}
#q{width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg);color:var(--fg);font-size:14px;outline:none}
#q:focus{border-color:var(--accent)}
.cats{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.chip{border:1px solid var(--border);background:var(--chip);color:var(--fg);border-radius:999px;padding:3px 12px;font-size:12px;cursor:pointer}
.chip:hover{border-color:var(--accent)}
.chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.chip .n{opacity:.65;margin-left:4px}
main{max-width:960px;margin:0 auto;padding:12px 16px 40px}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
li a{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--card);border:1px solid var(--border);border-radius:10px;text-decoration:none;color:var(--fg)}
li a:hover{background:var(--hover);border-color:var(--accent)}
.icon{flex:none;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:18px}
.icon img{width:20px;height:20px;border-radius:4px}
.badge{width:22px;height:22px;border-radius:6px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
.body{min-width:0;flex:1}
.title{display:block;font-weight:550;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.url{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.desc{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cat{flex:none;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--muted);border:1px solid var(--border);border-radius:6px;padding:2px 8px}
#empty{text-align:center;color:var(--muted);padding:48px 0}
footer{max-width:960px;margin:0 auto;padding:0 16px 32px;font-size:12px;color:var(--muted)}
@media (max-width:640px){.cat{display:none}}
</style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="top">
      <h1>Cloudmark <span class="mark">/${escapeHtml(mark)}</span></h1>
      <button id="theme" type="button"></button>
    </div>
    <p class="meta" id="meta"></p>
    <input id="q" type="search" autocomplete="off">
    <div class="cats" id="cats"></div>
  </div>
</header>
<main>
  <ul id="list"></ul>
  <p id="empty" hidden></p>
</main>
<footer id="foot"></footer>
<script type="application/json" id="data">${json}</script>
<script>
(function () {
  var payload = JSON.parse(document.getElementById("data").textContent);
  var L = {
    zh: {
      search: "搜索书签…（按 / 聚焦）",
      all: "全部",
      meta: "{n} 个书签 · 导出于 {time}",
      empty: "没有匹配的书签",
      theme: "切换主题",
      footer: "本地离线快照 · 数据为导出时的静态副本，不会自动更新 · 由 Cloudmark 生成"
    },
    en: {
      search: "Search bookmarks… (press /)",
      all: "All",
      meta: "{n} bookmarks · exported {time}",
      empty: "No matching bookmarks",
      theme: "Toggle theme",
      footer: "Offline snapshot · static copy at export time, never auto-updates · generated by Cloudmark"
    }
  };
  var t = L[payload.locale === "en" ? "en" : "zh"];
  var list = document.getElementById("list");
  var empty = document.getElementById("empty");
  var q = document.getElementById("q");
  var catsEl = document.getElementById("cats");
  var themeBtn = document.getElementById("theme");
  var cat = "";
  var query = "";

  document.getElementById("meta").textContent = t.meta
    .replace("{n}", String(payload.bookmarks.length))
    .replace("{time}", new Date(payload.exportedAt).toLocaleString());
  document.getElementById("foot").textContent = t.footer;
  q.placeholder = t.search;
  empty.textContent = t.empty;
  themeBtn.title = t.theme;

  var theme = "auto";
  try { theme = localStorage.getItem("cloudmark-snapshot-theme") || "auto"; } catch (e) {}
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", theme);
    themeBtn.textContent = theme === "auto" ? "◐" : theme === "light" ? "☀" : "☾";
    try { localStorage.setItem("cloudmark-snapshot-theme", theme); } catch (e) {}
  }
  themeBtn.addEventListener("click", function () {
    theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
    applyTheme();
  });
  applyTheme();

  var counts = {};
  function catsOf(b) {
    var out = [];
    (b.category || "").split(",").forEach(function (c) {
      c = c.trim();
      if (c) out.push(c);
    });
    return out.length ? out : ["default"];
  }
  payload.bookmarks.forEach(function (b) {
    catsOf(b).forEach(function (c) {
      counts[c] = (counts[c] || 0) + 1;
    });
  });
  var ordered = (payload.categories || []).filter(function (c) { return counts[c]; });
  Object.keys(counts).sort().forEach(function (c) {
    if (ordered.indexOf(c) === -1) ordered.push(c);
  });

  function matches(b) {
    if (cat) {
      var hit = catsOf(b).some(function (c) {
        return c === cat || c.indexOf(cat + " / ") === 0;
      });
      if (!hit) return false;
    }
    if (!query) return true;
    var hay = (b.title + " " + b.url + " " + (b.description || "") + " " + b.category).toLowerCase();
    return query.split(/\\s+/).every(function (tok) {
      return hay.indexOf(tok) !== -1;
    });
  }

  function makeIcon(b) {
    var wrap = document.createElement("span");
    wrap.className = "icon";
    var f = b.favicon || "";
    if (f.indexOf("emoji:") === 0) {
      wrap.textContent = f.slice(6);
    } else if (f.indexOf("data:image/") === 0) {
      var img = document.createElement("img");
      img.src = f;
      img.alt = "";
      wrap.appendChild(img);
    } else {
      var badge = document.createElement("span");
      badge.className = "badge";
      var letter = "?";
      try { letter = (new URL(b.url).hostname.replace(/^www\\./, "")[0] || "?").toUpperCase(); } catch (e) {}
      badge.textContent = letter;
      wrap.appendChild(badge);
    }
    return wrap;
  }

  function render() {
    list.textContent = "";
    var shown = 0;
    payload.bookmarks.forEach(function (b) {
      if (!matches(b)) return;
      shown++;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = b.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.appendChild(makeIcon(b));
      var body = document.createElement("span");
      body.className = "body";
      var title = document.createElement("span");
      title.className = "title";
      title.textContent = b.title || b.url;
      body.appendChild(title);
      var url = document.createElement("span");
      url.className = "url";
      url.textContent = b.url;
      body.appendChild(url);
      if (b.description) {
        var desc = document.createElement("span");
        desc.className = "desc";
        desc.textContent = b.description;
        body.appendChild(desc);
      }
      a.appendChild(body);
      var catTag = document.createElement("span");
      catTag.className = "cat";
      catTag.textContent = b.category || "default";
      a.appendChild(catTag);
      li.appendChild(a);
      list.appendChild(li);
    });
    empty.hidden = shown !== 0;
  }

  function renderCats() {
    catsEl.textContent = "";
    var all = document.createElement("button");
    all.type = "button";
    all.className = "chip" + (cat === "" ? " on" : "");
    all.textContent = t.all;
    var allN = document.createElement("span");
    allN.className = "n";
    allN.textContent = String(payload.bookmarks.length);
    all.appendChild(allN);
    all.addEventListener("click", function () { cat = ""; renderCats(); render(); });
    catsEl.appendChild(all);
    ordered.forEach(function (c) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (cat === c ? " on" : "");
      chip.textContent = c;
      var n = document.createElement("span");
      n.className = "n";
      n.textContent = String(counts[c]);
      chip.appendChild(n);
      chip.title = c;
      chip.addEventListener("click", function () { cat = cat === c ? "" : c; renderCats(); render(); });
      catsEl.appendChild(chip);
    });
  }

  q.addEventListener("input", function () {
    query = q.value.trim().toLowerCase();
    render();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== q) {
      e.preventDefault();
      q.focus();
    } else if (e.key === "Escape" && document.activeElement === q) {
      q.value = "";
      query = "";
      render();
      q.blur();
    }
  });

  renderCats();
  render();
})();
</script>
</body>
</html>
`;
}