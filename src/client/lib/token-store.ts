import { BANNER_DISMISS_PREFIX, TOKEN_STORAGE_PREFIX } from "@/shared/constants";
import { downloadJson, downloadTextFile } from "./download";

function tokenKey(mark: string): string {
  return `${TOKEN_STORAGE_PREFIX}${mark}`;
}

function bannerKey(mark: string): string {
  return `${BANNER_DISMISS_PREFIX}${mark}`;
}

function backupAckKey(mark: string): string {
  return `cloudmark:token-backup-ack:${mark}`;
}

export function getStoredWriteToken(mark: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(tokenKey(mark));
  } catch {
    return null;
  }
}

export function setStoredWriteToken(mark: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(tokenKey(mark), token);
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredWriteToken(mark: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(tokenKey(mark));
    localStorage.removeItem(backupAckKey(mark));
  } catch {
    // ignore
  }
}

export function isBannerDismissed(mark: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(bannerKey(mark)) === "1";
  } catch {
    return false;
  }
}

export function dismissBanner(mark: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(bannerKey(mark), "1");
  } catch {
    // ignore
  }
}

export function clearBannerDismiss(mark: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(bannerKey(mark));
  } catch {
    // ignore
  }
}

/** User confirmed they backed up the token for this mark */
export function isTokenBackupAcknowledged(mark: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(backupAckKey(mark)) === "1";
  } catch {
    return false;
  }
}

export function setTokenBackupAcknowledged(mark: string, acked: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (acked) localStorage.setItem(backupAckKey(mark), "1");
    else localStorage.removeItem(backupAckKey(mark));
  } catch {
    // ignore
  }
}

export interface TokenRecoveryPackage {
  version: 1;
  format: "cloudmark-token";
  mark: string;
  token: string;
  exportedAt: string;
  warning: string;
}

export function buildTokenRecoveryPackage(
  mark: string,
  token: string,
): TokenRecoveryPackage {
  return {
    version: 1,
    format: "cloudmark-token",
    mark,
    token,
    exportedAt: new Date().toISOString(),
    warning:
      "Anyone with this file can modify your Cloudmark collection. Store it offline and never commit it to git or share it publicly.",
  };
}

/** Download JSON recovery package + plain-text fallback */
export function downloadTokenBackup(mark: string, token: string): void {
  const pkg = buildTokenRecoveryPackage(mark, token);
  downloadJson(`cloudmark-token-${mark}.json`, pkg);
  downloadTextFile(
    `cloudmark-token-${mark}.txt`,
    [
      "Cloudmark write token backup",
      "===========================",
      `Mark:  ${mark}`,
      `Token: ${token}`,
      `When:  ${pkg.exportedAt}`,
      "",
      pkg.warning,
      "",
      "Restore: open your collection → Token → Paste token",
    ].join("\n"),
  );
  setTokenBackupAcknowledged(mark, true);
}

export function parseTokenRecoveryFile(
  text: string,
): { mark?: string; token: string } | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as Partial<TokenRecoveryPackage>;
      if (typeof data.token === "string" && data.token.length >= 16) {
        return {
          mark: typeof data.mark === "string" ? data.mark : undefined,
          token: data.token,
        };
      }
    } catch {
      // fall through
    }
  }
  // Plain text: look for Token: line or bare tok_...
  const tokenLine = trimmed.match(/Token:\s*(\S+)/i);
  if (tokenLine?.[1]) {
    const markLine = trimmed.match(/Mark:\s*(\S+)/i);
    return { mark: markLine?.[1], token: tokenLine[1] };
  }
  const bare = trimmed.match(/\b(tok_[A-Za-z0-9_-]+)\b/);
  if (bare?.[1]) return { token: bare[1] };
  // Entire file is a token
  if (/^[A-Za-z0-9_-]{16,128}$/.test(trimmed)) {
    return { token: trimmed };
  }
  return null;
}

/** List marks that have a stored token on this device */
export function listStoredTokenMarks(): string[] {
  if (typeof window === "undefined") return [];
  const marks: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(TOKEN_STORAGE_PREFIX)) {
        marks.push(key.slice(TOKEN_STORAGE_PREFIX.length));
      }
    }
  } catch {
    // ignore
  }
  return marks.sort();
}
