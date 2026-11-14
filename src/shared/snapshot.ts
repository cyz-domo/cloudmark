import type { BookmarkInstance } from "./types";

export interface SnapshotOptions {
  mark: string;
  bookmarks: BookmarkInstance[];
  /** Category names in the user's preferred order */
  categories?: string[];
  locale?: "zh" | "en";
  /** Live site origin, used by the in-snapshot sync button */
  baseUrl?: string;
  /** Wallpaper: data URL (offline-safe) or remote URL fallback */
  background?: string;
}

interface SnapshotPayload {
  mark: string;
  exportedAt: string;
  locale: "zh" | "en";
  categories: string[];
  baseUrl: string;
  background: string;
  deleted?: string[];
  bookmarks: Array<{
    uuid?: string;
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
 * styles/script. Opens from file:// and works offline; can sync live data,
 * re-export JSON/Netscape HTML, and download a refreshed copy of itself.
 */
export function exportSnapshotHtml(options: SnapshotOptions): string {
  const {
    mark,
    bookmarks,
    categories = [],
    locale = "zh",
    baseUrl = "",
    background = "",
  } = options;
  const payload: SnapshotPayload = {
    mark,
    exportedAt: new Date().toISOString(),
    locale,
    categories,
    baseUrl,
    background,
    bookmarks: bookmarks.map((b) => ({
      uuid: b.uuid,
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
:root{--paper:#FFFCF0;--surface:#F2F0E5;--fg:#282726;--muted:#6F6E69;--border:#E6E4D9;--border-strong:#DAD8CE;--accent:#205EA6;--hover:#F2F0E5;--mark-bg:#E6E4D9;--mark-fg:#6F6E69}
[data-theme="dark"]{--paper:#100F0F;--surface:#1C1B1A;--fg:#CECDC3;--muted:#878580;--border:#282726;--border-strong:#343331;--accent:#4385BE;--hover:#1C1B1A;--mark-bg:#282726;--mark-fg:#878580}
@media (prefers-color-scheme: dark){[data-theme="auto"]{--paper:#100F0F;--surface:#1C1B1A;--fg:#CECDC3;--muted:#878580;--border:#282726;--border-strong:#343331;--accent:#4385BE;--hover:#1C1B1A;--mark-bg:#282726;--mark-fg:#878580}}
*{box-sizing:border-box}
html{background:var(--paper)}
body{margin:0;color:var(--fg);font:14px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
#bg{position:fixed;inset:0;z-index:0;background-size:cover;background-position:center;background-attachment:fixed}
#bg::after{content:"";position:absolute;inset:0;background:var(--paper);opacity:0;transition:opacity .3s}
.has-wall #bg::after{opacity:.25}
.shell{position:relative;z-index:1;display:flex;min-height:100vh}
#side{width:var(--side-w,200px);flex:none;display:flex;flex-direction:column;gap:14px;padding:20px 14px;background:var(--paper);border-right:1px solid var(--border);position:sticky;top:0;height:100vh;overflow-y:auto}
#resizer{flex:none;width:6px;cursor:col-resize;background:transparent;position:relative;z-index:6;touch-action:none}
#resizer:hover,#resizer.drag{background:color-mix(in srgb,var(--accent) 35%,transparent)}
.has-wall #side,.has-wall .topbar,.has-wall .list-panel{background:color-mix(in srgb,var(--paper) 65%,transparent)}
.has-wall #q,.has-wall .btn,.has-wall dialog{background:color-mix(in srgb,var(--paper) 82%,transparent)}
.brand{font-size:15px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:baseline;gap:7px}
.brand .mark{color:var(--muted);font-weight:400;font-family:ui-monospace,Consolas,monospace;font-size:13px}
#q{width:100%;padding:7px 12px;border:1px solid var(--border-strong);border-radius:6px;background:var(--paper);color:var(--fg);font-size:14px;outline:none}
#q:focus{border-color:var(--accent)}
#cats{display:flex;flex-direction:column;gap:1px;flex:1}
.cat-item{display:flex;align-items:center;gap:8px;width:100%;border:none;background:transparent;color:var(--muted);border-radius:6px;padding:6px 10px;font-size:13px;cursor:pointer;text-align:left;font-family:inherit;transition:background .15s,color .15s}
.cat-item:hover{background:var(--hover);color:var(--fg)}
.cat-item.on{background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent);font-weight:600}
.cat-item .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cat-item .n{flex:none;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.cat-item.on .n{color:var(--accent)}
.side-foot{display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--border);padding-top:14px}
.auto{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);cursor:pointer}
.side-btns{display:flex;gap:6px;flex-wrap:wrap}
.content{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--paper);border-bottom:1px solid var(--border);padding:12px 20px}
.meta{margin:0;font-size:12px;color:var(--muted);flex:1;min-width:140px}
.actions{display:flex;gap:6px;flex-wrap:wrap}
.btn{border:1px solid var(--border-strong);background:var(--paper);color:var(--fg);border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px;font-family:inherit;transition:background .15s,border-color .15s}
.btn:hover{background:var(--hover);border-color:var(--muted)}
.btn:disabled{opacity:.5;cursor:default}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.primary:hover{filter:brightness(1.06)}
#menu{display:none}
main{width:100%;max-width:860px;margin:0 auto;padding:20px}
.list-panel{background:var(--paper);border:1px solid var(--border);border-radius:8px;padding:4px 6px}
ul{list-style:none;margin:0;padding:0}
li+li{border-top:1px solid var(--border)}
.row{display:flex;align-items:center}
.row a{flex:1;min-width:0;display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:6px;text-decoration:none;color:var(--fg);transition:background .15s}
.row:hover a{background:var(--hover)}
.row-actions{flex:none;display:flex;gap:2px;padding-right:6px;opacity:0;transition:opacity .15s}
.row:hover .row-actions,.row:focus-within .row-actions{opacity:1}
.act{border:none;background:transparent;color:var(--muted);cursor:pointer;border-radius:5px;width:26px;height:26px;font-size:13px;display:flex;align-items:center;justify-content:center;font-family:inherit}
.act:hover{background:var(--hover);color:var(--fg)}
.act.del:hover{color:#AF3029}
.icon{flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:16px}
.icon img{width:16px;height:16px;border-radius:3px}
.badge{width:16px;height:16px;border-radius:3px;background:var(--mark-bg);color:var(--mark-fg);font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center}
.body{min-width:0;flex:1}
.title{display:block;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.url{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.desc{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cat{flex:none;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--muted)}
#empty{text-align:center;color:var(--muted);padding:48px 0}
footer{width:100%;max-width:860px;margin:0 auto;padding:0 20px 32px;font-size:12px;color:var(--muted)}
#scrim{display:none}
#toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:50;background:var(--fg);color:var(--paper);padding:8px 16px;border-radius:6px;font-size:13px;max-width:90vw}
dialog{border:1px solid var(--border-strong);border-radius:8px;background:var(--paper);color:var(--fg);padding:22px;max-width:min(420px,90vw)}
dialog::backdrop{background:rgba(0,0,0,.4)}
.dlg-title{margin:0 0 6px;font-weight:600;font-size:15px}
.dlg-desc{margin:0 0 12px;font-size:13px;color:var(--muted)}
#tokenInput{width:100%;padding:7px 12px;border:1px solid var(--border-strong);border-radius:6px;background:var(--paper);color:var(--fg);font-size:14px;outline:none;font-family:inherit}
#tokenInput:focus{border-color:var(--accent)}
.dlg-remember{display:flex;align-items:center;gap:7px;margin-top:12px;font-size:12px;color:var(--muted);cursor:pointer}
.dlg-warn{margin:8px 0 0;font-size:12px;color:#AD8301}
.dlg-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.fld{margin-bottom:10px}
.fld label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
.fld input{width:100%;padding:7px 12px;border:1px solid var(--border-strong);border-radius:6px;background:var(--paper);color:var(--fg);font-size:14px;outline:none;font-family:inherit}
.fld input:focus{border-color:var(--accent)}
.has-wall .fld input{background:color-mix(in srgb,var(--paper) 82%,transparent)}
.dirty{color:var(--accent);font-size:11px;margin-left:6px}
.fld textarea{width:100%;padding:7px 12px;border:1px solid var(--border-strong);border-radius:6px;background:var(--paper);color:var(--fg);font-size:14px;outline:none;font-family:inherit;resize:vertical;min-height:54px}
.fld textarea:focus{border-color:var(--accent)}
.has-wall .fld textarea{background:color-mix(in srgb,var(--paper) 82%,transparent)}
.fld-hint{margin:4px 0 0;font-size:11px;color:var(--muted)}
.iconpick{display:flex;align-items:center;gap:8px}
.iconpick input{flex:1;min-width:0;width:auto}
.iconprev{flex:none;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:20px;overflow:hidden}
.iconprev img{width:22px;height:22px;border-radius:4px}
.iconprev .badge{width:22px;height:22px;font-size:12px}
.iconprev .icon{width:24px;height:24px;font-size:20px}
.emojirow{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.emojirow button{border:1px solid var(--border);background:transparent;border-radius:6px;width:30px;height:30px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.emojirow button:hover{background:var(--hover)}
.favsite{margin-top:8px;width:100%;font-size:12px}
@media (max-width:760px){
#side{position:fixed;left:0;top:0;bottom:0;z-index:30;width:min(280px,80vw);height:100vh;transform:translateX(-100%);transition:transform .25s;box-shadow:2px 0 12px rgba(0,0,0,.12)}
.shell.side-open #side{transform:none}
.shell.side-open #scrim{display:block;position:fixed;inset:0;z-index:20;background:rgba(0,0,0,.3)}
#menu{display:inline-flex}
#resizer{display:none}
.row-actions{opacity:1}
.cat{display:none}
}
</style>
</head>
<body>
<div id="bg"></div>
<div class="shell" id="shell">
  <div id="scrim"></div>
  <aside id="side">
    <div class="brand">Cloudmark <span class="mark">/${escapeHtml(mark)}</span></div>
    <input id="q" type="search" autocomplete="off">
    <nav id="cats"></nav>
    <div class="side-foot">
      <label class="auto"><input type="checkbox" id="autoSync"><span id="autoSyncLabel"></span></label>
      <div class="side-btns">
        <button id="wall" type="button" class="btn"></button>
        <button id="wallClear" type="button" class="btn" hidden></button>
        <button id="theme" type="button" class="btn"></button>
      </div>
    </div>
  </aside>
  <div id="resizer"></div>
  <div class="content">
    <div class="topbar">
      <button id="menu" type="button" class="btn">☰</button>
      <p class="meta" id="meta"></p>
      <div class="actions">
        <button id="add" type="button" class="btn"></button>
        <button id="sync" type="button" class="btn"></button>
        <button id="push" type="button" class="btn"></button>
        <button id="expJson" type="button" class="btn"></button>
        <button id="expHtml" type="button" class="btn"></button>
        <button id="save" type="button" class="btn"></button>
      </div>
    </div>
    <main>
      <div class="list-panel">
        <ul id="list"></ul>
        <p id="empty" hidden></p>
      </div>
    </main>
    <footer id="foot"></footer>
  </div>
</div>
<dialog id="tokenDlg">
  <p class="dlg-title" id="dlgTitle"></p>
  <p class="dlg-desc" id="dlgDesc"></p>
  <input id="tokenInput" type="password" autocomplete="off">
  <label class="dlg-remember"><input type="checkbox" id="rememberToken"><span id="rememberLabel"></span></label>
  <p class="dlg-warn" id="dlgWarn"></p>
  <div class="dlg-btns">
    <button id="dlgCancel" type="button" class="btn"></button>
    <button id="dlgOk" type="button" class="btn primary"></button>
  </div>
</dialog>
<dialog id="editDlg">
  <p class="dlg-title" id="editTitle"></p>
  <div class="fld"><label id="lblUrl"></label><input id="fUrl" type="url" autocomplete="off" placeholder="https://…"></div>
  <div class="fld"><label id="lblTitle"></label><input id="fTitle" type="text" autocomplete="off"></div>
  <div class="fld"><label id="lblDesc"></label><textarea id="fDesc" rows="2"></textarea></div>
  <div class="fld"><label id="lblCat"></label><input id="fCat" type="text" list="catList" autocomplete="off"><datalist id="catList"></datalist><p class="fld-hint" id="catHint"></p></div>
  <div class="fld">
    <label id="lblFav"></label>
    <div class="iconpick">
      <span class="iconprev" id="iconPrev"></span>
      <input id="fFav" type="text" autocomplete="off">
      <button id="favClear" type="button" class="btn">×</button>
    </div>
    <div class="emojirow" id="emojiRow"></div>
    <button id="favSite" type="button" class="btn favsite"></button>
  </div>
  <p class="dlg-warn" id="editErr" hidden></p>
  <div class="dlg-btns">
    <button id="editDelete" type="button" class="btn" hidden></button>
    <span style="flex:1"></span>
    <button id="editCancel" type="button" class="btn"></button>
    <button id="editSave" type="button" class="btn primary"></button>
  </div>
</dialog>
<div id="toast" hidden></div>
<input type="file" id="wallFile" accept="image/*" hidden>
<script type="application/json" id="data">${json}</script>
<script>
(function () {
  var dataEl = document.getElementById("data");
  var embedded = JSON.parse(dataEl.textContent);
  var mark = embedded.mark;
  var dataKey = "cloudmark-snapshot-data:" + mark;
  var wallKey = "cloudmark-snapshot-wall:" + mark;
  var tokenKey = "cloudmark-snapshot-token:" + mark;
  var autoKey = "cloudmark-snapshot-auto:" + mark;
  var themeKey = "cloudmark-snapshot-theme";
  var sideKey = "cloudmark-snapshot-sidew:" + mark;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var payload = embedded;
  var syncedAt = "";
  var ovRaw = lsGet(dataKey);
  if (ovRaw) {
    try {
      var ov = JSON.parse(ovRaw);
      if (ov && ov.version === 1 && ov.payload && Array.isArray(ov.payload.bookmarks) && ov.savedAt > embedded.exportedAt) {
        payload = ov.payload;
        syncedAt = ov.savedAt;
      }
    } catch (e) {}
  }

  var L = {
    zh: {
      search: "搜索书签…（按 / 聚焦）",
      all: "全部",
      meta: "{n} 个书签 · 导出于 {time}",
      metaSynced: "{n} 个书签 · 同步于 {time}",
      empty: "没有匹配的书签",
      theme: "切换主题",
      menu: "分类列表",
      footer: "本地离线快照 · 同步数据保存在本浏览器，点「存快照」下载最新副本 · 由 Cloudmark 生成",
      sync: "⟳ 同步",
      syncing: "同步中…",
      syncTitle: "从在线收藏拉取最新数据",
      syncDone: "已同步 {n} 个书签",
      syncFailed: "同步失败：",
      noServer: "此快照未包含在线地址，无法同步",
      notFound: "在线收藏不存在或已被删除",
      expJson: "JSON",
      expJsonTitle: "导出 Cloudmark JSON（可导回 Cloudmark）",
      expHtml: "HTML",
      expHtmlTitle: "导出浏览器书签 HTML（Netscape 格式）",
      expDone: "已导出 {n} 个书签",
      save: "⬇ 存快照",
      saveTitle: "把当前数据重新下载为快照文件",
      saveDone: "已下载最新快照文件",
      wall: "🖼 壁纸",
      wallClear: "✕",
      wallClearTitle: "移除壁纸",
      wallSet: "壁纸已设置",
      wallCleared: "壁纸已移除",
      wallFailed: "无法读取该图片",
      wallTooBig: "图片过大，本地存储失败，请换一张较小的图片",
      autoSync: "打开时自动同步",
      dlgTitle: "私有收藏",
      dlgDesc: "该收藏不公开，同步需要输入收藏令牌。",
      dlgRemember: "在此浏览器记住令牌",
      dlgWarn: "令牌可修改该收藏，仅建议在私人设备上记住。",
      dlgOk: "同步",
      dlgCancel: "取消",
      add: "＋ 添加",
      addTitle: "添加书签（先存本地，可推送到 web）",
      push: "↑ 推送",
      pushTitle: "把本地修改同步到在线收藏",
      pushNone: "没有需要推送的修改",
      pushDone: "已推送 {n} 项修改到 web",
      pushFailed: "推送失败：",
      pushDlgTitle: "推送到 web",
      pushDlgDesc: "输入收藏的写入令牌，把本地修改同步到在线收藏。",
      pushDlgOk: "推送",
      editDlgTitle: "编辑书签",
      addDlgTitle: "添加书签",
      lblUrl: "网址",
      lblTitle: "标题",
      lblCat: "分类",
      lblDesc: "描述（可选）",
      lblFav: "图标（可选）",
      favPh: "emoji:🐙 或 https://…/favicon.ico",
      editSave: "保存",
      editCancel: "取消",
      editDelete: "删除",
      deleteConfirm: "确定删除这个书签？",
      errUrl: "网址需以 http:// 或 https:// 开头",
      errTitle: "请填写标题",
      edited: "编辑于 {time}",
      pending: "待推送 {n}",
      favSite: "使用网站图标",
      favClear: "清除图标",
      catHint: "多个分类用逗号分隔"
    },
    en: {
      search: "Search bookmarks… (press /)",
      all: "All",
      meta: "{n} bookmarks · exported {time}",
      metaSynced: "{n} bookmarks · synced {time}",
      empty: "No matching bookmarks",
      theme: "Toggle theme",
      menu: "Categories",
      footer: "Offline snapshot · synced data lives in this browser, use Save snapshot to download a fresh copy · generated by Cloudmark",
      sync: "⟳ Sync",
      syncing: "Syncing…",
      syncTitle: "Fetch latest data from the live collection",
      syncDone: "Synced {n} bookmarks",
      syncFailed: "Sync failed: ",
      noServer: "This snapshot has no live server address and cannot sync",
      notFound: "The live collection no longer exists",
      expJson: "JSON",
      expJsonTitle: "Export Cloudmark JSON (re-importable into Cloudmark)",
      expHtml: "HTML",
      expHtmlTitle: "Export browser bookmarks HTML (Netscape format)",
      expDone: "Exported {n} bookmarks",
      save: "⬇ Save",
      saveTitle: "Download current data as a new snapshot file",
      saveDone: "Downloaded a fresh snapshot file",
      wall: "🖼 Wallpaper",
      wallClear: "✕",
      wallClearTitle: "Remove wallpaper",
      wallSet: "Wallpaper set",
      wallCleared: "Wallpaper removed",
      wallFailed: "Could not read that image",
      wallTooBig: "Image too large to store locally — try a smaller one",
      autoSync: "Auto-sync on open",
      dlgTitle: "Private collection",
      dlgDesc: "This collection is private. Enter its token to sync.",
      dlgRemember: "Remember token in this browser",
      dlgWarn: "The token can modify this collection — only remember it on private devices.",
      dlgOk: "Sync",
      dlgCancel: "Cancel",
      add: "＋ Add",
      addTitle: "Add a bookmark (saved locally, push to web later)",
      push: "↑ Push",
      pushTitle: "Sync local changes to the live collection",
      pushNone: "No local changes to push",
      pushDone: "Pushed {n} changes to web",
      pushFailed: "Push failed: ",
      pushDlgTitle: "Push to web",
      pushDlgDesc: "Enter the collection write token to sync local changes online.",
      pushDlgOk: "Push",
      editDlgTitle: "Edit bookmark",
      addDlgTitle: "Add bookmark",
      lblUrl: "URL",
      lblTitle: "Title",
      lblCat: "Category",
      lblDesc: "Description (optional)",
      lblFav: "Icon (optional)",
      favPh: "emoji:🐙 or https://…/favicon.ico",
      editSave: "Save",
      editCancel: "Cancel",
      editDelete: "Delete",
      deleteConfirm: "Delete this bookmark?",
      errUrl: "URL must start with http:// or https://",
      errTitle: "Title is required",
      edited: "edited {time}",
      pending: "{n} pending",
      favSite: "Use site icon",
      favClear: "Clear icon",
      catHint: "Separate multiple categories with commas"
    }
  };
  var t = L[payload.locale === "en" ? "en" : "zh"];

  var shell = document.getElementById("shell");
  var list = document.getElementById("list");
  var empty = document.getElementById("empty");
  var q = document.getElementById("q");
  var catsEl = document.getElementById("cats");
  var metaEl = document.getElementById("meta");
  var themeBtn = document.getElementById("theme");
  var syncBtn = document.getElementById("sync");
  var expJsonBtn = document.getElementById("expJson");
  var expHtmlBtn = document.getElementById("expHtml");
  var saveBtn = document.getElementById("save");
  var wallBtn = document.getElementById("wall");
  var wallClearBtn = document.getElementById("wallClear");
  var wallFile = document.getElementById("wallFile");
  var bg = document.getElementById("bg");
  var autoSync = document.getElementById("autoSync");
  var menuBtn = document.getElementById("menu");
  var scrim = document.getElementById("scrim");
  var toastEl = document.getElementById("toast");
  var tokenDlg = document.getElementById("tokenDlg");
  var tokenInput = document.getElementById("tokenInput");
  var rememberToken = document.getElementById("rememberToken");
  var dlgOk = document.getElementById("dlgOk");
  var dlgCancel = document.getElementById("dlgCancel");
  var addBtn = document.getElementById("add");
  var pushBtn = document.getElementById("push");
  var resizer = document.getElementById("resizer");
  var editDlg = document.getElementById("editDlg");
  var editTitle = document.getElementById("editTitle");
  var fUrl = document.getElementById("fUrl");
  var fTitle = document.getElementById("fTitle");
  var fCat = document.getElementById("fCat");
  var fDesc = document.getElementById("fDesc");
  var fFav = document.getElementById("fFav");
  var catList = document.getElementById("catList");
  var editErr = document.getElementById("editErr");
  var editDelete = document.getElementById("editDelete");
  var editCancel = document.getElementById("editCancel");
  var editSave = document.getElementById("editSave");
  var iconPrev = document.getElementById("iconPrev");
  var favClear = document.getElementById("favClear");
  var emojiRow = document.getElementById("emojiRow");
  var favSite = document.getElementById("favSite");

  var cat = "";
  var query = "";
  var sessionToken = "";
  var busy = false;

  q.placeholder = t.search;
  empty.textContent = t.empty;
  document.getElementById("foot").textContent = t.footer;
  themeBtn.title = t.theme;
  menuBtn.title = t.menu;
  syncBtn.textContent = t.sync;
  syncBtn.title = t.syncTitle;
  expJsonBtn.textContent = t.expJson;
  expJsonBtn.title = t.expJsonTitle;
  expHtmlBtn.textContent = t.expHtml;
  expHtmlBtn.title = t.expHtmlTitle;
  saveBtn.textContent = t.save;
  saveBtn.title = t.saveTitle;
  wallBtn.textContent = t.wall;
  wallClearBtn.textContent = t.wallClear;
  wallClearBtn.title = t.wallClearTitle;
  document.getElementById("autoSyncLabel").textContent = t.autoSync;
  document.getElementById("dlgTitle").textContent = t.dlgTitle;
  document.getElementById("dlgDesc").textContent = t.dlgDesc;
  document.getElementById("rememberLabel").textContent = t.dlgRemember;
  document.getElementById("dlgWarn").textContent = t.dlgWarn;
  dlgOk.textContent = t.dlgOk;
  dlgCancel.textContent = t.dlgCancel;
  addBtn.textContent = t.add;
  addBtn.title = t.addTitle;
  pushBtn.title = t.pushTitle;
  document.getElementById("lblUrl").textContent = t.lblUrl;
  document.getElementById("lblTitle").textContent = t.lblTitle;
  document.getElementById("lblCat").textContent = t.lblCat;
  document.getElementById("lblDesc").textContent = t.lblDesc;
  document.getElementById("lblFav").textContent = t.lblFav;
  fFav.placeholder = t.favPh;
  editSave.textContent = t.editSave;
  editCancel.textContent = t.editCancel;
  editDelete.textContent = t.editDelete;
  document.getElementById("catHint").textContent = t.catHint;
  favSite.textContent = t.favSite;
  favClear.title = t.favClear;

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3200);
  }

  var theme = lsGet(themeKey) || "auto";
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", theme);
    themeBtn.textContent = theme === "auto" ? "◐" : theme === "light" ? "☀" : "☾";
    lsSet(themeKey, theme);
  }
  themeBtn.addEventListener("click", function () {
    theme = theme === "auto" ? "light" : theme === "light" ? "dark" : "auto";
    applyTheme();
  });
  applyTheme();

  function currentWall() { return lsGet(wallKey) || payload.background || ""; }
  function applyWall() {
    var w = currentWall();
    bg.style.backgroundImage = w ? "url(" + JSON.stringify(w) + ")" : "none";
    document.documentElement.classList.toggle("has-wall", !!w);
    wallClearBtn.hidden = !w;
  }
  wallBtn.addEventListener("click", function () { wallFile.click(); });
  wallFile.addEventListener("change", function () {
    var f = wallFile.files && wallFile.files[0];
    wallFile.value = "";
    if (f) pickWall(f);
  });
  function pickWall(file) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var max = 1920;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      var dataUrl;
      try { dataUrl = canvas.toDataURL("image/jpeg", 0.85); } catch (e) { toast(t.wallFailed); return; }
      if (!lsSet(wallKey, dataUrl)) { toast(t.wallTooBig); return; }
      applyWall();
      toast(t.wallSet);
    };
    img.onerror = function () { URL.revokeObjectURL(url); toast(t.wallFailed); };
    img.src = url;
  }
  wallClearBtn.addEventListener("click", function () {
    lsDel(wallKey);
    applyWall();
    toast(t.wallCleared);
  });
  applyWall();

  var sideW = parseInt(lsGet(sideKey), 10);
  if (sideW >= 150 && sideW <= 480) document.documentElement.style.setProperty("--side-w", sideW + "px");
  var dragging = false;
  resizer.addEventListener("pointerdown", function (e) {
    dragging = true;
    resizer.classList.add("drag");
    resizer.setPointerCapture(e.pointerId);
    document.body.style.userSelect = "none";
    e.preventDefault();
  });
  resizer.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var w = Math.min(480, Math.max(150, e.clientX));
    document.documentElement.style.setProperty("--side-w", w + "px");
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    resizer.classList.remove("drag");
    document.body.style.userSelect = "";
    var w = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--side-w"), 10);
    if (w) lsSet(sideKey, String(w));
  }
  resizer.addEventListener("pointerup", endDrag);
  resizer.addEventListener("pointercancel", endDrag);

  var counts = {};
  var ordered = [];
  function catsOf(b) {
    var out = [];
    (b.category || "").split(",").forEach(function (c) {
      c = c.trim();
      if (c) out.push(c);
    });
    return out.length ? out : ["default"];
  }
  function recomputeCats() {
    counts = {};
    payload.bookmarks.forEach(function (b) {
      catsOf(b).forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    });
    ordered = (payload.categories || []).filter(function (c) { return counts[c]; });
    Object.keys(counts).sort().forEach(function (c) {
      if (ordered.indexOf(c) === -1) ordered.push(c);
    });
  }

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

  function firstChar(s) {
    var str = (s || "").trim();
    if (!str) return "?";
    var ch = Array.from(str)[0] || "?";
    return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
  }

  function makeBadge(b) {
    var badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = firstChar(b.title || b.url);
    return badge;
  }

  function makeIcon(b) {
    var wrap = document.createElement("span");
    wrap.className = "icon";
    var f = b.favicon || "";
    if (f.indexOf("emoji:") === 0) {
      wrap.textContent = f.slice(6);
      return wrap;
    }
    if (f.indexOf("data:image/") === 0 || f.indexOf("http://") === 0 || f.indexOf("https://") === 0) {
      var img = document.createElement("img");
      img.src = f;
      img.alt = "";
      img.onerror = function () {
        wrap.textContent = "";
        wrap.appendChild(makeBadge(b));
      };
      wrap.appendChild(img);
      return wrap;
    }
    wrap.appendChild(makeBadge(b));
    return wrap;
  }

  function render() {
    list.textContent = "";
    var shown = 0;
    payload.bookmarks.forEach(function (b) {
      if (!matches(b)) return;
      shown++;
      var li = document.createElement("li");
      var row = document.createElement("div");
      row.className = "row";
      var a = document.createElement("a");
      if (/^https?:\\/\\//i.test(b.url || "")) a.href = b.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.appendChild(makeIcon(b));
      var body = document.createElement("span");
      body.className = "body";
      var title = document.createElement("span");
      title.className = "title";
      title.textContent = b.title || b.url;
      if (b.dirty) {
        var dot = document.createElement("span");
        dot.className = "dirty";
        dot.textContent = "●";
        dot.title = t.pending.replace("{n}", "");
        title.appendChild(dot);
      }
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
      row.appendChild(a);
      var actions = document.createElement("div");
      actions.className = "row-actions";
      var editB = document.createElement("button");
      editB.type = "button";
      editB.className = "act";
      editB.textContent = "✎";
      editB.title = t.editDlgTitle;
      editB.addEventListener("click", function () { openEdit(b.uuid); });
      var delB = document.createElement("button");
      delB.type = "button";
      delB.className = "act del";
      delB.textContent = "✕";
      delB.title = t.editDelete;
      delB.addEventListener("click", function () { confirmDelete(b.uuid); });
      actions.appendChild(editB);
      actions.appendChild(delB);
      row.appendChild(actions);
      li.appendChild(row);
      list.appendChild(li);
    });
    empty.hidden = shown !== 0;
  }

  function closeSide() { shell.classList.remove("side-open"); }
  menuBtn.addEventListener("click", function () { shell.classList.toggle("side-open"); });
  scrim.addEventListener("click", closeSide);

  function renderCats() {
    catsEl.textContent = "";
    var all = document.createElement("button");
    all.type = "button";
    all.className = "cat-item" + (cat === "" ? " on" : "");
    var allName = document.createElement("span");
    allName.className = "name";
    allName.textContent = t.all;
    all.appendChild(allName);
    var allN = document.createElement("span");
    allN.className = "n";
    allN.textContent = String(payload.bookmarks.length);
    all.appendChild(allN);
    all.addEventListener("click", function () { cat = ""; renderCats(); render(); closeSide(); });
    catsEl.appendChild(all);
    ordered.forEach(function (c) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "cat-item" + (cat === c ? " on" : "");
      item.title = c;
      var name = document.createElement("span");
      name.className = "name";
      name.textContent = c;
      item.appendChild(name);
      var n = document.createElement("span");
      n.className = "n";
      n.textContent = String(counts[c]);
      item.appendChild(n);
      item.addEventListener("click", function () { cat = cat === c ? "" : c; renderCats(); render(); closeSide(); });
      catsEl.appendChild(item);
    });
  }

  function pendingCount() {
    var n = (payload.deleted || []).length;
    payload.bookmarks.forEach(function (b) { if (b.dirty) n++; });
    return n;
  }
  function updatePushBtn() {
    var n = pendingCount();
    pushBtn.textContent = n ? t.push + " (" + n + ")" : t.push;
  }
  function updateMeta() {
    var base = (syncedAt ? t.metaSynced : t.meta)
      .replace("{n}", String(payload.bookmarks.length))
      .replace("{time}", new Date(syncedAt || payload.exportedAt).toLocaleString());
    var n = pendingCount();
    if (n) base += " · " + t.pending.replace("{n}", String(n));
    metaEl.textContent = base;
    updatePushBtn();
  }

  function uid() {
    return "local-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function persist() {
    var now = new Date().toISOString();
    syncedAt = now;
    lsSet(dataKey, JSON.stringify({ version: 1, savedAt: now, payload: payload }));
  }
  function refresh() {
    recomputeCats();
    renderCats();
    render();
    updateMeta();
  }
  function addBookmark(data) {
    payload.bookmarks.push({
      uuid: uid(),
      url: data.url,
      title: data.title,
      description: data.description,
      category: data.category,
      favicon: data.favicon,
      createdAt: new Date().toISOString(),
      dirty: "new"
    });
    persist();
    refresh();
  }
  function updateBookmark(uuid, data) {
    payload.bookmarks.forEach(function (b) {
      if (b.uuid !== uuid) return;
      b.url = data.url;
      b.title = data.title;
      b.description = data.description;
      b.category = data.category;
      b.favicon = data.favicon;
      if (b.dirty !== "new") b.dirty = "edit";
    });
    persist();
    refresh();
  }
  function deleteBookmark(uuid) {
    var target = null;
    payload.bookmarks.forEach(function (b) { if (b.uuid === uuid) target = b; });
    payload.bookmarks = payload.bookmarks.filter(function (b) { return b.uuid !== uuid; });
    if (target && target.dirty !== "new" && uuid && uuid.indexOf("local-") !== 0) {
      payload.deleted = payload.deleted || [];
      if (payload.deleted.indexOf(uuid) === -1) payload.deleted.push(uuid);
    }
    persist();
    refresh();
  }
  function confirmDelete(uuid) {
    if (window.confirm(t.deleteConfirm)) deleteBookmark(uuid);
  }

  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }

  expJsonBtn.addEventListener("click", function () {
    var out = {
      version: 1,
      format: "cloudmark",
      mark: mark,
      exportedAt: new Date().toISOString(),
      bookmarks: payload.bookmarks.map(function (b) {
        return { url: b.url, title: b.title, description: b.description, category: b.category, createdAt: b.createdAt, favicon: b.favicon };
      })
    };
    download("cloudmark-" + mark + "-bookmarks-" + stamp() + ".json", JSON.stringify(out, null, 2), "application/json;charset=utf-8");
    toast(t.expDone.replace("{n}", String(payload.bookmarks.length)));
  });

  expHtmlBtn.addEventListener("click", function () {
    var groups = {};
    payload.bookmarks.forEach(function (b) {
      if (!/^https?:\\/\\//i.test(b.url || "")) return;
      var c = b.category || "default";
      (groups[c] = groups[c] || []).push(b);
    });
    var lines = [
      "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      "<TITLE>Bookmarks — " + esc(mark) + "</TITLE>",
      "<H1>Bookmarks — " + esc(mark) + "</H1>",
      "<DL><p>"
    ];
    Object.keys(groups).sort().forEach(function (c) {
      lines.push("    <DT><H3>" + esc(c) + "</H3>", "    <DL><p>");
      groups[c].forEach(function (b) {
        var addDate = Math.floor(new Date(b.createdAt).getTime() / 1000);
        lines.push('        <DT><A HREF="' + esc(b.url) + '" ADD_DATE="' + addDate + '">' + esc(b.title || b.url) + "</A>");
        if (b.description) lines.push("        <DD>" + esc(b.description));
      });
      lines.push("    </DL><p>");
    });
    lines.push("</DL><p>");
    download("cloudmark-" + mark + "-bookmarks-" + stamp() + ".html", lines.join("\\n"), "text/html;charset=utf-8");
    toast(t.expDone.replace("{n}", String(payload.bookmarks.length)));
  });

  saveBtn.addEventListener("click", function () {
    var copy = {
      mark: mark,
      exportedAt: syncedAt || payload.exportedAt,
      locale: payload.locale,
      categories: payload.categories,
      baseUrl: payload.baseUrl,
      background: currentWall(),
      deleted: payload.deleted,
      bookmarks: payload.bookmarks
    };
    var LT = String.fromCharCode(92) + "u003c";
    dataEl.textContent = JSON.stringify(copy).replace(/</g, LT);
    list.textContent = "";
    catsEl.textContent = "";
    var html = "<!DOCTYPE html>\\n" + document.documentElement.outerHTML;
    download("cloudmark-" + mark + "-snapshot.html", html, "text/html;charset=utf-8");
    renderCats();
    render();
    toast(t.saveDone);
  });

  var editingUuid = null;
  function openEdit(uuid) {
    editingUuid = uuid || null;
    editErr.hidden = true;
    catList.textContent = "";
    ordered.forEach(function (c) {
      var o = document.createElement("option");
      o.value = c;
      catList.appendChild(o);
    });
    var b = null;
    if (editingUuid) payload.bookmarks.forEach(function (x) { if (x.uuid === editingUuid) b = x; });
    if (b) {
      editTitle.textContent = t.editDlgTitle;
      fUrl.value = b.url || "";
      fTitle.value = b.title || "";
      fCat.value = b.category || "";
      fDesc.value = b.description || "";
      fFav.value = b.favicon || "";
      editDelete.hidden = false;
    } else {
      editTitle.textContent = t.addDlgTitle;
      fUrl.value = "";
      fTitle.value = "";
      fCat.value = cat || "default";
      fDesc.value = "";
      fFav.value = "";
      editDelete.hidden = true;
    }
    updateIconPrev();
    editDlg.showModal();
    fUrl.focus();
  }
  function normFav(v) {
    v = (v || "").trim();
    if (!v) return undefined;
    if (/^(emoji:|data:image\\/|https?:)/i.test(v)) return v;
    return "emoji:" + v;
  }
  function updateIconPrev() {
    iconPrev.textContent = "";
    iconPrev.appendChild(makeIcon({ favicon: normFav(fFav.value), title: fTitle.value || fUrl.value || "?" }));
  }
  var EMOJIS = ["🌐", "📁", "⭐", "📰", "🎨", "💻", "🔧", "📚", "🎬", "🎵", "🛒", "💬", "📷", "🚀", "🔖", "📌"];
  EMOJIS.forEach(function (e) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = e;
    b.addEventListener("click", function () { fFav.value = "emoji:" + e; updateIconPrev(); });
    emojiRow.appendChild(b);
  });
  fFav.addEventListener("input", updateIconPrev);
  fTitle.addEventListener("input", updateIconPrev);
  fUrl.addEventListener("input", updateIconPrev);
  favClear.addEventListener("click", function () { fFav.value = ""; updateIconPrev(); });
  favSite.addEventListener("click", function () {
    try { fFav.value = new URL(fUrl.value).origin + "/favicon.ico"; updateIconPrev(); } catch (e) {}
  });
  function saveEdit() {
    var url = fUrl.value.trim();
    var title = fTitle.value.trim();
    var category = fCat.value.trim() || "default";
    if (!/^https?:\\/\\//i.test(url)) { editErr.textContent = t.errUrl; editErr.hidden = false; fUrl.focus(); return; }
    if (!title) { editErr.textContent = t.errTitle; editErr.hidden = false; fTitle.focus(); return; }
    var data = { url: url, title: title, description: fDesc.value.trim() || undefined, category: category, favicon: normFav(fFav.value) };
    if (editingUuid) updateBookmark(editingUuid, data); else addBookmark(data);
    editDlg.close();
  }
  editSave.addEventListener("click", saveEdit);
  editCancel.addEventListener("click", function () { editDlg.close(); });
  editDelete.addEventListener("click", function () { var u = editingUuid; editDlg.close(); if (u) confirmDelete(u); });
  addBtn.addEventListener("click", function () { openEdit(null); });
  editDlg.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); saveEdit(); }
  });

  function req(method, path, body) {
    return fetch(payload.baseUrl + path, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || ("HTTP " + r.status));
        return d;
      });
    });
  }
  function doPush() {
    if (busy) return;
    if (!payload.baseUrl) { toast(t.noServer); return; }
    var token = sessionToken || lsGet(tokenKey) || "";
    if (!token) { openTokenDlg("push"); return; }
    var creates = payload.bookmarks.filter(function (b) { return b.dirty === "new"; });
    var edits = payload.bookmarks.filter(function (b) { return b.dirty === "edit"; });
    var dels = (payload.deleted || []).slice();
    if (!creates.length && !edits.length && !dels.length) { toast(t.pushNone); return; }
    setBusy(true);
    var okCount = 0;
    var err = "";
    var chain = Promise.resolve();
    creates.forEach(function (b) {
      chain = chain.then(function () {
        return req("POST", "/api/bookmarks", { mark: mark, token: token, url: b.url, title: b.title, description: b.description, category: b.category, favicon: b.favicon })
          .then(function (resp) { b.uuid = resp.uuid; b.favicon = resp.favicon; b.createdAt = resp.createdAt; delete b.dirty; okCount++; persist(); })
          .catch(function (e) { err = e.message; });
      });
    });
    edits.forEach(function (b) {
      chain = chain.then(function () {
        return req("PUT", "/api/bookmarks/" + encodeURIComponent(b.uuid), { mark: mark, token: token, url: b.url, title: b.title, description: b.description, category: b.category, favicon: b.favicon })
          .then(function () { delete b.dirty; okCount++; persist(); })
          .catch(function (e) { err = e.message; });
      });
    });
    dels.forEach(function (uuid) {
      chain = chain.then(function () {
        return req("DELETE", "/api/bookmarks/" + encodeURIComponent(uuid), { mark: mark, token: token })
          .then(function () { payload.deleted = (payload.deleted || []).filter(function (x) { return x !== uuid; }); okCount++; persist(); })
          .catch(function (e) { err = e.message; });
      });
    });
    chain.then(function () {
      setBusy(false);
      refresh();
      if (err) toast(t.pushFailed + err);
      else { toast(t.pushDone.replace("{n}", String(okCount))); doSync(true); }
    });
  }
  pushBtn.addEventListener("click", function () { doPush(); });

  function setBusy(v) {
    busy = v;
    syncBtn.disabled = v;
    syncBtn.textContent = v ? t.syncing : t.sync;
    pushBtn.disabled = v;
    addBtn.disabled = v;
  }
  var dlgMode = "sync";
  function openTokenDlg(mode) {
    dlgMode = mode || "sync";
    if (dlgMode === "push") {
      document.getElementById("dlgTitle").textContent = t.pushDlgTitle;
      document.getElementById("dlgDesc").textContent = t.pushDlgDesc;
      dlgOk.textContent = t.pushDlgOk;
    } else {
      document.getElementById("dlgTitle").textContent = t.dlgTitle;
      document.getElementById("dlgDesc").textContent = t.dlgDesc;
      dlgOk.textContent = t.dlgOk;
    }
    tokenInput.value = "";
    tokenDlg.showModal();
    tokenInput.focus();
  }
  dlgCancel.addEventListener("click", function () { tokenDlg.close(); });
  dlgOk.addEventListener("click", function () {
    sessionToken = tokenInput.value.trim();
    if (rememberToken.checked) lsSet(tokenKey, sessionToken); else lsDel(tokenKey);
    tokenDlg.close();
    if (sessionToken) { if (dlgMode === "push") doPush(); else doSync(false); }
  });
  tokenInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); dlgOk.click(); }
  });

  function doSync(silent) {
    if (busy) return;
    if (!payload.baseUrl) { if (!silent) toast(t.noServer); return; }
    setBusy(true);
    var headers = {};
    var token = sessionToken || lsGet(tokenKey) || "";
    if (token) headers["X-Cloudmark-Token"] = token;
    fetch(payload.baseUrl + "/api/collections/" + encodeURIComponent(mark), { headers: headers })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        setBusy(false);
        if (!res.ok) throw new Error((res.d && res.d.error) || "HTTP error");
        var d = res.d;
        if (d.privateLocked) { openTokenDlg(); return; }
        if (!d.exists || !d.bookmarksData || !Array.isArray(d.bookmarksData.bookmarks)) throw new Error(t.notFound);
        payload = {
          mark: mark,
          exportedAt: new Date().toISOString(),
          locale: payload.locale,
          categories: Array.isArray(d.categories) ? d.categories : [],
          baseUrl: payload.baseUrl,
          background: payload.background,
          bookmarks: d.bookmarksData.bookmarks.map(function (b) {
            return { uuid: b.uuid, url: b.url, title: b.title, description: b.description, category: b.category, favicon: b.favicon, createdAt: b.createdAt };
          })
        };
        syncedAt = payload.exportedAt;
        lsSet(dataKey, JSON.stringify({ version: 1, savedAt: syncedAt, payload: payload }));
        recomputeCats();
        renderCats();
        render();
        updateMeta();
        if (!silent) toast(t.syncDone.replace("{n}", String(payload.bookmarks.length)));
      })
      .catch(function (e) {
        setBusy(false);
        if (!silent) toast(t.syncFailed + (e && e.message ? e.message : ""));
      });
  }
  syncBtn.addEventListener("click", function () { doSync(false); });

  autoSync.checked = lsGet(autoKey) === "1";
  autoSync.addEventListener("change", function () {
    lsSet(autoKey, autoSync.checked ? "1" : "0");
    if (autoSync.checked) doSync(true);
  });

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

  recomputeCats();
  renderCats();
  render();
  updateMeta();
  if (autoSync.checked) doSync(true);
})();
</script>
</body>
</html>
`;
}