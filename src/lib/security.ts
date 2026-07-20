import {
  MARK_MAX_LENGTH,
  MARK_MIN_LENGTH,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  RESERVED_MARKS,
  TOKEN_MAX_LENGTH,
  TOKEN_MIN_LENGTH,
} from "./constants";

/**
 * Generate a high-entropy write token (base64url, ~32 chars of entropy).
 */
export function generateWriteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `tok_${bytesToBase64Url(bytes)}`;
}

/**
 * Generate a higher-entropy collection mark.
 * Format: adjective-noun-randomhex (hex adds ~32 bits of entropy).
 */
export function generateSecureMark(): string {
  const adjectives = [
    "swift",
    "quiet",
    "bright",
    "calm",
    "bold",
    "clear",
    "vivid",
    "noble",
    "rapid",
    "solid",
    "keen",
    "wise",
  ];
  const nouns = [
    "harbor",
    "meadow",
    "summit",
    "river",
    "forest",
    "canvas",
    "signal",
    "orbit",
    "ledger",
    "anchor",
    "prism",
    "vault",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const entropy = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(4)))
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .toLowerCase();
  return `${adj}-${noun}-${entropy}`;
}

export function isValidMarkFormat(mark: string): boolean {
  if (mark.length < MARK_MIN_LENGTH || mark.length > MARK_MAX_LENGTH) {
    return false;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(mark)) {
    return false;
  }
  if (RESERVED_MARKS.has(mark.toLowerCase())) {
    return false;
  }
  return true;
}

export function isValidTokenFormat(token: string): boolean {
  return (
    token.length >= TOKEN_MIN_LENGTH &&
    token.length <= TOKEN_MAX_LENGTH &&
    /^[a-zA-Z0-9_-]+$/.test(token)
  );
}

/**
 * SHA-256 hash of a write token as hex string.
 * Only the hash is stored in D1; plaintext tokens live on the client.
 */
export async function hashWriteToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyWriteToken(
  token: string,
  storedHash: string,
): Promise<boolean> {
  if (!isValidTokenFormat(token) || !storedHash) {
    return false;
  }
  const hash = await hashWriteToken(token);
  return timingSafeEqual(hash, storedHash);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Simple sliding-window rate limiter backed by D1.
 * Returns true if the request is allowed.
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
): Promise<boolean> {
  const now = Date.now();
  const row = await db
    .prepare("SELECT count, window_start FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row || now - row.window_start > RATE_LIMIT_WINDOW_MS) {
    await db
      .prepare(
        `INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)
         ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
      )
      .bind(key, now)
      .run();
    return true;
  }

  if (row.count >= RATE_LIMIT_MAX) {
    return false;
  }

  await db
    .prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?")
    .bind(key)
    .run();
  return true;
}
