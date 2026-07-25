import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  X,
  BookmarkPlus,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildBookmarkletCode } from "@/shared/bookmarklet";
import {
  dismissBanner,
  downloadTokenBackup,
  getStoredWriteToken,
  isBannerDismissed,
  setStoredWriteToken,
  setTokenBackupAcknowledged,
} from "@/client/lib/token-store";
import { useTranslations } from "@/client/i18n/context";
import { BookmarkletLink } from "@/client/components/bookmarklet-link";

interface MigrationBannerProps {
  mark: string;
  baseUrl: string;
  /** One-time server-issued token (migration / first delivery) */
  issuedWriteToken?: string;
  migratedFromKv?: boolean;
  onTokenReady: (token: string | null) => void;
}

/**
 * Only for server-issued / migration tokens the user must save.
 * Device attach (paste token) lives on the collection page via TokenUnlockForm.
 */
export function MigrationBanner({
  mark,
  baseUrl,
  issuedWriteToken,
  migratedFromKv,
  onTokenReady,
}: MigrationBannerProps) {
  const t = useTranslations("BookmarksPage.SecurityBanner");
  const tTok = useTranslations("TokenManager");
  const [visible, setVisible] = useState(false);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState<"token" | "bookmarklet" | null>(null);

  useEffect(() => {
    if (issuedWriteToken) {
      setStoredWriteToken(mark, issuedWriteToken);
      setToken(issuedWriteToken);
      onTokenReady(issuedWriteToken);
      setVisible(true);
      return;
    }

    const stored = getStoredWriteToken(mark) || "";
    if (stored && migratedFromKv && !isBannerDismissed(mark)) {
      setToken(stored);
      onTokenReady(stored);
      setVisible(true);
      return;
    }

    setVisible(false);
  }, [mark, issuedWriteToken, migratedFromKv, onTokenReady]);

  const bookmarkletCode = useMemo(() => {
    if (!token) return "";
    return buildBookmarkletCode(baseUrl, mark, token);
  }, [baseUrl, mark, token]);

  if (!visible || !token) return null;

  const copy = async (kind: "token" | "bookmarklet") => {
    const text = kind === "token" ? token : bookmarkletCode;
    await navigator.clipboard.writeText(text);
    if (kind === "token") setTokenBackupAcknowledged(mark, true);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  const title = migratedFromKv ? t("migratedTitle") : t("issuedTitle");
  const description = migratedFromKv
    ? t("migratedDescription")
    : t("issuedDescription");

  return (
    <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <div>
            <p className="font-medium leading-tight">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => {
            dismissBanner(mark);
            setVisible(false);
          }}
          title={t("dismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="space-y-2 pl-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("yourToken")}</span>
          <code className="max-w-[14rem] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-2xs">
            {token}
          </code>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => void copy("token")}
          >
            {copied === "token" ? (
              <Check className="mr-1 h-3 w-3" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {t("copyToken")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => downloadTokenBackup(mark, token)}
          >
            <Download className="mr-1 h-3 w-3" />
            {tTok("downloadBackup")}
          </Button>
        </div>
        <p className="text-2xs text-amber-700 dark:text-amber-400">
          {t("tokenWarning")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("newBookmarklet")}
          </span>
          <BookmarkletLink code={bookmarkletCode} className="inline-flex">
            <Button size="sm" variant="outline" className="h-7 cursor-grab" asChild>
              <span>
                <BookmarkPlus className="mr-1 h-3 w-3" />
                {t("saveButton", { mark })}
              </span>
            </Button>
          </BookmarkletLink>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => void copy("bookmarklet")}
          >
            {copied === "bookmarklet" ? (
              <Check className="mr-1 h-3 w-3" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {t("copyBookmarklet")}
          </Button>
        </div>
        <p className="text-2xs text-muted-foreground">{t("bookmarkletHint")}</p>
      </div>
    </div>
  );
}
