import { FAVICON_MAX_LENGTH } from "./constants";

export const EMOJI_ICON_PREFIX = "emoji:";

/** Simple colored SVG mark presets (letter / shape) as data URLs */
export function makeMarkIcon(
  label: string,
  bg = "#3b82f6",
  fg = "#ffffff",
): string {
  const text = (label || "?").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${bg}"/>
  <text x="32" y="42" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="${fg}">${escapeXml(text)}</text>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const COLOR_PRESETS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#64748b",
  "#0f172a",
  "#14b8a6",
] as const;

export function emojiIcon(emoji: string): string {
  return `${EMOJI_ICON_PREFIX}${emoji}`;
}

export function isEmojiIcon(value: string | undefined | null): boolean {
  return Boolean(value?.startsWith(EMOJI_ICON_PREFIX));
}

export function emojiFromIcon(value: string): string {
  return value.slice(EMOJI_ICON_PREFIX.length);
}

/** Google s2 favicon helper */
export function siteFaviconUrl(pageUrl: string, size = 64): string {
  try {
    const domain = new URL(pageUrl).hostname.replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
  } catch {
    return "";
  }
}

export function isValidFaviconValue(value: string | undefined | null): boolean {
  if (value == null || value === "") return true;
  if (value.length > FAVICON_MAX_LENGTH) return false;
  if (value.startsWith(EMOJI_ICON_PREFIX)) {
    const e = value.slice(EMOJI_ICON_PREFIX.length);
    return e.length > 0 && e.length <= 16;
  }
  if (value.startsWith("data:image/")) {
    // data:image/png;base64,... or data:image/svg+xml,...
    return /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml|x-icon|vnd\.microsoft\.icon);/i.test(
      value,
    );
  }
  // http(s) URL
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Basic SVG sanitization for uploads (strip scripts / handlers) */
export function sanitizeSvg(svgText: string): string {
  return svgText
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
