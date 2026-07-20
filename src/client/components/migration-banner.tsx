import { useEffect, useMemo, useState } from "react";
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
import { buildBookmarkletCode } from "@/shared/bookmarklet";
import {
  dismissBanner,
  getStoredWriteToken,
  isBannerDismissed,
  setStoredWriteToken,
} from "@/client/lib/token-store";
import { generateWriteToken, isValidTokenFormat } from "@/shared/security";
import { useTranslations } from "@/client/i18n/context";
import { BookmarkletLink } from "@/client/components/bookmarklet-link";

interface MigrationBannerProps {
  mark: string;
  baseUrl: string;
  issuedWriteToken?: string;
  migratedFromKv?: boolean;
  onTokenReady: (token: string | null) => void;
  /** Open full token manager (backup / rotate) */
  onOpenTokenManager?: () => void;
}

export function MigrationBanner({
  mark,
  baseUrl,
  issuedWriteToken,
  migratedFromKv,
  onTokenReady,
  onOpenTokenManager,
}: MigrationBannerProps) {
  const t = useTranslations("BookmarksPage.SecurityBanner");
  const [visible, setVisible] = useState(false);
  const [token, setToken] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [copied, setCopied] = useState<"token" | "bookmarklet" | null>(null);

  useEffect(() => {
    if (issuedWriteToken) {
      setStoredWriteToken(mark, issuedWriteToken);
      setToken(issuedWriteToken);
      onTokenReady(issuedWriteToken);
      setVisible(true);
      return;
    }

    const stored = getStoredWriteToken(mark);
    if (stored) {
      setToken(stored);
      onTokenReady(stored);
      if (migratedFromKv && !isBannerDismissed(mark)) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    } else {
      setVisible(true);
    }
  }, [mark, issuedWriteToken, migratedFromKv, onTokenReady]);

  const bookmarkletCode = useMemo(() => {
    if (!token) return "";
    return buildBookmarkletCode(baseUrl, mark, token);
  }, [baseUrl, mark, token]);

  if (!visible) return null;

  const copy = async (kind: "token" | "bookmarklet") => {
    const text = kind === "token" ? token : bookmarkletCode;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  };

  const saveManual = () => {
    const trimmed = manualToken.trim();
    if (!isValidTokenFormat(trimmed)) return;
    setStoredWriteToken(mark, trimmed);
    setToken(trimmed);
    onTokenReady(trimmed);
  };

  const generate = () => {
    // Prefer the guided token manager (forces backup ack)
    if (onOpenTokenManager) {
      onOpenTokenManager();
      return;
    }
    const next = generateWriteToken();
    setStoredWriteToken(mark, next);
    setToken(next);
    onTokenReady(next);
  };

  const title = migratedFromKv
    ? t("migratedTitle")
    : token
      ? t("updateTitle")
      : t("tokenRequiredTitle");
  const description = migratedFromKv
    ? t("migratedDescription")
    : token
      ? t("updateDescription")
      : t("tokenRequiredDescription");

  return (
    <div className="mb-3 rounded-md border border-blue-500/25 bg-blue-500/5 px-3 py-2.5 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium leading-tight">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {token ? (
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
        ) : null}
      </div>

      {!token ? (
        <div className="space-y-2 pl-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder={t("tokenPlaceholder")}
              className="h-8 font-mono text-xs"
            />
            <Button size="sm" className="h-8" onClick={saveManual}>
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              {t("saveToken")}
            </Button>
          </div>
          <p className="text-2xs text-muted-foreground">{t("pasteHint")}</p>
          <div className="flex items-center gap-2 text-2xs text-muted-foreground">
            <span>{t("or")}</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-2xs"
              onClick={generate}
            >
              {t("generateToken")}
            </Button>
          </div>
          <p className="flex items-start gap-1 text-2xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {t("generateHint")}
          </p>
        </div>
      ) : (
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
              onClick={() => copy("token")}
            >
              {copied === "token" ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Copy className="mr-1 h-3 w-3" />
              )}
              {t("copyToken")}
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
              onClick={() => copy("bookmarklet")}
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
      )}
    </div>
  );
}
