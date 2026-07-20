import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Bookmark,
  Check,
  Copy,
  Download,
  ExternalLink,
  HashIcon,
  KeyRound,
  RefreshCcw,
  Shield,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateRandomMark, getBaseUrl } from "@/shared/utils";
import { generateWriteToken } from "@/shared/security";
import { buildBookmarkletCode } from "@/shared/bookmarklet";
import {
  downloadTokenBackup,
  setStoredWriteToken,
  setTokenBackupAcknowledged,
} from "@/client/lib/token-store";
import { useTranslations } from "@/client/i18n/context";
import { BookmarkletLink } from "@/client/components/bookmarklet-link";

export function DocPage() {
  const t = useTranslations("DocPage");
  const [mark, setMark] = useState("");
  const [writeToken, setWriteToken] = useState("");
  const [copied, setCopied] = useState<"code" | "token" | "url" | null>(null);

  const baseUrl = getBaseUrl();

  const bookmarkletCode = useMemo(() => {
    if (!mark || !writeToken) return "";
    return buildBookmarkletCode(baseUrl, mark, writeToken);
  }, [baseUrl, mark, writeToken]);

  useEffect(() => {
    const m = generateRandomMark();
    const tok = generateWriteToken();
    setMark(m);
    setWriteToken(tok);
    setStoredWriteToken(m, tok);
  }, []);

  useEffect(() => {
    if (mark && writeToken) {
      setStoredWriteToken(mark, writeToken);
    }
  }, [mark, writeToken]);

  const handleCopy = (kind: "code" | "token" | "url") => {
    const text =
      kind === "code"
        ? bookmarkletCode
        : kind === "token"
          ? writeToken
          : `${baseUrl}/${mark}`;
    void navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const regenerateAll = () => {
    const nextMark = generateRandomMark();
    const nextToken = generateWriteToken();
    setMark(nextMark);
    setWriteToken(nextToken);
    setStoredWriteToken(nextMark, nextToken);
  };

  if (!mark) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mb-8 text-muted-foreground">{t("description")}</p>

      <section className="mb-10 space-y-3">
        <h2 className="text-xl font-semibold">{t("intro.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("intro.description")}</p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>{t("intro.features.oneClick")}</li>
          <li>{t("intro.features.cloud")}</li>
          <li>{t("intro.features.categories")}</li>
          <li>{t("intro.features.sorting")}</li>
          <li>{t("intro.features.multilingual")}</li>
        </ul>
      </section>

      <section className="mb-10 space-y-4 rounded-lg border border-border/60 bg-card/40 p-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Wand2 className="h-5 w-5" />
          {t("setup.title")}
        </h2>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <HashIcon className="h-3.5 w-3.5" />
            {t("setup.markName.title")}
          </label>
          <div className="flex gap-2">
            <Input
              value={mark}
              onChange={(e) =>
                setMark(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
              }
              placeholder={t("setup.markName.placeholder")}
              className="h-9 font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={regenerateAll}
            >
              <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
              {t("setup.markName.button")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("setup.markName.description")}
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <KeyRound className="h-3.5 w-3.5" />
            {t("setup.writeToken.title")}
          </label>
          <div className="flex gap-2">
            <Input
              value={writeToken}
              readOnly
              className="h-9 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => handleCopy("token")}
            >
              {copied === "token" ? (
                <Check className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1 h-3.5 w-3.5" />
              )}
              {t("setup.writeToken.copy")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              title={t("setup.writeToken.copy")}
              onClick={() => {
                if (
                  writeToken &&
                  !window.confirm(t("setup.writeToken.regenerateConfirm"))
                ) {
                  return;
                }
                const next = generateWriteToken();
                setWriteToken(next);
                setStoredWriteToken(mark, next);
                setTokenBackupAcknowledged(mark, false);
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              disabled={!writeToken}
              onClick={() => {
                if (!writeToken) return;
                downloadTokenBackup(mark, writeToken);
              }}
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            <Shield className="mt-0.5 h-3 w-3 shrink-0" />
            {t("setup.writeToken.description")}
          </p>
          <p className="text-2xs text-amber-700 dark:text-amber-400">
            {t("setup.writeToken.backupHint")}
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-sm font-medium">
            <Bookmark className="h-3.5 w-3.5" />
            {t("setup.bookmarklet.title")}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <BookmarkletLink code={bookmarkletCode} className="inline-flex">
              <Button size="sm" className="h-9 cursor-grab" asChild>
                <span>{t("setup.bookmarklet.saveButton", { mark })}</span>
              </Button>
            </BookmarkletLink>
            <span className="text-xs text-muted-foreground">
              {t("setup.bookmarklet.dragTip")}
            </span>
            <Button asChild size="sm" variant="outline" className="h-9">
              <Link to={`/${mark}`}>
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                {t("setup.bookmarklet.openButton", { mark })}
              </Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9"
              onClick={() => handleCopy("code")}
            >
              {copied === "code" ? (
                <Check className="mr-1 h-3.5 w-3.5" />
              ) : (
                <Copy className="mr-1 h-3.5 w-3.5" />
              )}
              {t("setup.code.copied")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("setup.bookmarklet.description")}
          </p>
        </div>
      </section>

      <section className="mb-10 space-y-3">
        <h2 className="text-xl font-semibold">{t("usage.title")}</h2>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
          <li>
            <strong className="text-foreground">
              {t("usage.steps.setup.title")}
            </strong>
            — {t("usage.steps.setup.description")}
          </li>
          <li>
            <strong className="text-foreground">
              {t("usage.steps.save.title")}
            </strong>
            — {t("usage.steps.save.description")}
          </li>
          <li>
            <strong className="text-foreground">
              {t("usage.steps.access.title")}
            </strong>
            — {t("usage.steps.access.description", { baseUrl, mark })}
          </li>
          <li>
            <strong className="text-foreground">
              {t("usage.steps.manage.title")}
            </strong>
            — {t("usage.steps.manage.description")}
          </li>
        </ol>
      </section>

      <section className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
        <h2 className="mb-1 text-lg font-semibold">{t("demo.title")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          {t("demo.description")}
        </p>
        <Button asChild>
          <Link to="/demo">{t("demo.button")}</Link>
        </Button>
      </section>
    </div>
  );
}
