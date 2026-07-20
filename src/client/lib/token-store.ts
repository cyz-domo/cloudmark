import { BANNER_DISMISS_PREFIX, TOKEN_STORAGE_PREFIX } from "@/shared/constants";

function tokenKey(mark: string): string {
  return `${TOKEN_STORAGE_PREFIX}${mark}`;
}

function bannerKey(mark: string): string {
  return `${BANNER_DISMISS_PREFIX}${mark}`;
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
