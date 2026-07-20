/**
 * Build a drag-to-bookmarks-bar bookmarklet that saves the current page.
 *
 * Encoding notes:
 * - The script body is fully percent-encoded so browsers cannot turn bare `+`
 *   into spaces (a common silent failure for javascript: URLs).
 * - Avoid `+` concatenation inside the script; use Array#join / concat only.
 * - Prefer top-level navigation (location.assign) so popup blockers cannot
 *   cancel the save; fall back to open() if assign is unavailable.
 */
export function buildBookmarkletCode(
  baseUrl: string,
  mark: string,
  writeToken: string,
): string {
  const base = baseUrl.replace(/\/$/, "");

  // Keep the IIFE tiny and free of `+` operators.
  const body = [
    "(function(){",
    `var m=${JSON.stringify(mark)},`,
    `k=${JSON.stringify(writeToken)},`,
    `b=${JSON.stringify(base)},`,
    'p=["/api/add?mark=",encodeURIComponent(m),"&token=",encodeURIComponent(k),',
    '"&title=",encodeURIComponent(document.title||"Untitled"),',
    '"&url=",encodeURIComponent(location.href)].join(""),',
    "u=b.concat(p);",
    "try{location.assign(u)}catch(e){location.href=u}",
    "})()",
  ].join("");

  return `javascript:${encodeURIComponent(body)}`;
}

/** Decode a stored bookmarklet back to readable JS (debug / copy UX). */
export function bookmarkletBodyForDisplay(code: string): string {
  if (!code.startsWith("javascript:")) return code;
  try {
    return decodeURIComponent(code.slice("javascript:".length));
  } catch {
    return code;
  }
}
