"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  X,
  BookmarkPlus,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildBookmarkletCode } from "@/lib/bookmarklet";
import {
  dismissBanner,
  getStoredWriteToken,
  isBannerDismissed,
  setStoredWriteToken,
} from "@/lib/token-store";
import { generateWriteToken, isValidTokenFormat } from "@/lib/security";

interface MigrationBannerProps {
  mark: string;
  baseUrl: string;
  /** Token just issued by the server (migration / first claim) */
  issuedWriteToken?: string;
  migratedFromKv?: boolean;
  /** Called when the client has a usable write token */
  onTokenReady: (token: string) => void;
}

export function MigrationBanner({
  mark,
  baseUrl,
  issuedWriteToken,
  migratedFromKv,
  onTokenReady,
}: MigrationBannerProps) {
  const t = useTranslations("BookmarksPage.SecurityBanner");
  const [visible, setVisible] = useState(false);
  const [token, setToken] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [copied, setCopied] = useState<"token" | "bookmarklet" | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Persist server-issued token immediately
    if (issuedWriteToken) {
      setStoredWriteToken(mark, issuedWriteToken);
      setToken(issuedWriteToken);
      onTokenReady(issuedWriteToken);
      // Always show banner after migration so user can reinstall bookmarklet
      setVisible(true);
      setHydrated(true);
      return;
    }

    const stored = getStoredWriteToken(mark);
    if (stored) {
      setToken(stored);
      onTokenReady(stored);
      // Show banner only if not dismissed (e.g. user may still need new bookmarklet)
      if (migratedFromKv && !isBannerDismissed(mark)) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    } else {
      // No token — must show banner so user can paste / recover
      setVisible(true);
    }
    setHydrated(true);
  }, [mark, issuedWriteToken, migratedFromKv, onTokenReady]);

  const bookmarkletCode = useMemo(() => {
    if (!token) return "";
    return buildBookmarkletCode(baseUrl, mark, token);
  }, [baseUrl, mark, token]);

  const handleDismiss = () => {
    dismissBanner(mark);
    setVisible(false);
  };

  const handleSaveManual = () => {
    const trimmed = manualToken.trim();
    if (!isValidTokenFormat(trimmed)) {
      return;
    }
    setStoredWriteToken(mark, trimmed);
    setToken(trimmed);
    onTokenReady(trimmed);
  };

  const handleGenerateToken = () => {
    const next = generateWriteToken();
    setStoredWriteToken(mark, next);
    setToken(next);
    onTokenReady(next);
    setVisible(true);
  };

  const copyText = async (text: string, kind: "token" | "bookmarklet") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  if (!hydrated || !visible) {
    return null;
  }

  return (
    <div className="mb-8 rounded-xl border border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-yellow-500/10 backdrop-blur-sm p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
          {migratedFromKv || issuedWriteToken ? (
            <AlertTriangle className="h-5 w-5" />
          ) : (
            <Shield className="h-5 w-5" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                {issuedWriteToken || migratedFromKv
                  ? t("migratedTitle")
                  : token
                    ? t("updateTitle")
                    : t("tokenRequiredTitle")}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {issuedWriteToken || migratedFromKv
                  ? t("migratedDescription")
                  : token
                    ? t("updateDescription")
                    : t("tokenRequiredDescription")}
              </p>
            </div>
            {token ? (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleDismiss}
                aria-label={t("dismiss")}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>

          {!token ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  {t("pasteToken")}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                    placeholder={t("tokenPlaceholder")}
                    className="font-mono text-sm border-amber-500/30 bg-background/80"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    onClick={handleSaveManual}
                    disabled={!isValidTokenFormat(manualToken.trim())}
                    className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                  >
                    {t("saveToken")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("pasteHint")}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>{t("or")}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateToken}
                className="w-full sm:w-auto border-amber-500/30"
              >
                <KeyRound className="h-4 w-4 mr-2" />
                {t("generateToken")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("generateHint")}</p>
            </div>
          ) : (
            <>
              {/* Write token */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  {t("yourToken")}
                </label>
                <div className="flex gap-2">
                  <code className="flex-1 truncate rounded-md border border-amber-500/20 bg-background/80 px-3 py-2 text-xs sm:text-sm font-mono">
                    {token}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-amber-500/30"
                    onClick={() => copyText(token, "token")}
                  >
                    {copied === "token" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-1.5 hidden sm:inline">
                      {t("copyToken")}
                    </span>
                  </Button>
                </div>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                  {t("tokenWarning")}
                </p>
              </div>

              {/* New bookmarklet */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  {t("newBookmarklet")}
                </label>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <a
                    href="#"
                    draggable={true}
                    ref={(node) => {
                      if (node && bookmarkletCode) {
                        node.setAttribute("href", bookmarkletCode);
                      }
                    }}
                    onClick={(e) => e.preventDefault()}
                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20 text-foreground h-9 px-4 py-2 cursor-move shadow-sm"
                    title={t("dragTip")}
                  >
                    <BookmarkPlus className="h-4 w-4 mr-2 text-blue-500" />
                    {t("saveButton", { mark })}
                  </a>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-500/30"
                    onClick={() => copyText(bookmarkletCode, "bookmarklet")}
                  >
                    {copied === "bookmarklet" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-1.5">{t("copyBookmarklet")}</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("bookmarkletHint")}</p>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="text-muted-foreground"
                >
                  {t("dismiss")}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
