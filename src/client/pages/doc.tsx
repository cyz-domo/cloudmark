import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router";
import {
  BookmarkPlus,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Hash,
  KeyRound,
  Loader2,
  RefreshCcw,
  Settings2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateRandomMark, getBaseUrl, cn } from "@/shared/utils";
import { generateWriteToken } from "@/shared/security";
import { buildBookmarkletCode } from "@/shared/bookmarklet";
import {
  DEFAULT_COLLECTION_SETTINGS,
  type CollectionSettings,
} from "@/shared/types";
import {
  downloadTokenBackup,
  isTokenBackupAcknowledged,
  setStoredWriteToken,
  setTokenBackupAcknowledged,
} from "@/client/lib/token-store";
import { claimCollectionApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";
import { BookmarkletLink } from "@/client/components/bookmarklet-link";
import { CollectionSettingsFields } from "@/client/components/collection-settings-fields";
import { DragBookmarkletDemo } from "@/client/components/drag-bookmarklet-demo";

type StepId = "name" | "token" | "settings" | "install";

const STEPS: StepId[] = ["name", "token", "settings", "install"];

export function DocPage() {
  const t = useTranslations("DocPage");
  const navigate = useNavigate();
  const [mark, setMark] = useState("");
  const [writeToken, setWriteToken] = useState("");
  const [settings, setSettings] = useState<CollectionSettings>({
    ...DEFAULT_COLLECTION_SETTINGS,
  });
  const [openStep, setOpenStep] = useState<StepId>("name");
  const [done, setDone] = useState<Partial<Record<StepId, boolean>>>({});
  const [copied, setCopied] = useState<"token" | "code" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [claimed, setClaimed] = useState(false);

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
    if (mark && writeToken) setStoredWriteToken(mark, writeToken);
  }, [mark, writeToken]);

  const copy = async (kind: "token" | "code") => {
    const text = kind === "token" ? writeToken : bookmarkletCode;
    await navigator.clipboard.writeText(text);
    if (kind === "token" && mark) {
      setTokenBackupAcknowledged(mark, true);
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 1600);
  };

  const regenerateAll = () => {
    const nextMark = generateRandomMark();
    const nextToken = generateWriteToken();
    setMark(nextMark);
    setWriteToken(nextToken);
    setStoredWriteToken(nextMark, nextToken);
    setClaimed(false);
    setDone({});
    setOpenStep("name");
  };

  const syncToServer = useCallback(
    async (nextSettings = settings) => {
      if (!mark || !writeToken) return false;
      setSyncing(true);
      try {
        const result = await claimCollectionApi({
          mark,
          token: writeToken,
          settings: nextSettings,
        });
        setSettings(result.settings);
        setClaimed(true);
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("setup.syncFailed"));
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [mark, writeToken, settings, t],
  );

  const completeStep = async (step: StepId) => {
    if (step === "name") {
      if (mark.trim().length < 4) {
        toast.error(t("setup.name.tooShort"));
        return;
      }
      // Bind token to the chosen mark before claim
      setStoredWriteToken(mark, writeToken);
      setDone((d) => ({ ...d, name: true }));
      setOpenStep("token");
      return;
    }
    if (step === "token") {
      if (!isTokenBackupAcknowledged(mark)) {
        toast.error(t("setup.token.mustBackup"));
        return;
      }
      // Claim immediately with defaults so later private settings / open cannot race.
      const ok = await syncToServer({ ...DEFAULT_COLLECTION_SETTINGS });
      if (!ok) return;
      toast.success(t("setup.token.claimed"));
      setDone((d) => ({ ...d, token: true }));
      setOpenStep("settings");
      return;
    }
    if (step === "settings") {
      // Update claimed collection (including isPublic) with the same token.
      const ok = await syncToServer(settings);
      if (!ok) return;
      setDone((d) => ({ ...d, settings: true }));
      setOpenStep("install");
      return;
    }
    if (step === "install") {
      setDone((d) => ({ ...d, install: true }));
    }
  };

  const toggleStep = (step: StepId) => {
    setOpenStep((cur) => (cur === step ? cur : step));
  };

  if (!mark) {
    return (
      <div className="container flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container relative max-w-xl py-10 sm:py-14">
      <div
        className="pointer-events-none absolute inset-x-0 -top-8 -z-10 h-48 opacity-70"
        aria-hidden
      >
        <div className="orb orb-a left-1/2 h-40 w-40 -translate-x-1/2" />
      </div>

      <header className="reveal mb-8 text-center">
        <h1 className="display-font text-3xl font-bold tracking-tight sm:text-4xl">
          <span className="text-gradient">{t("title")}</span>
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t("description")}
        </p>
      </header>

      {/* Progress dots */}
      <ol className="reveal reveal-delay-1 mb-6 flex items-center justify-center gap-2">
        {STEPS.map((id, i) => {
          const active = openStep === id;
          const finished = Boolean(done[id]);
          return (
            <li key={id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleStep(id)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  finished && "bg-primary text-primary-foreground",
                  active && !finished && "bg-primary/15 text-primary ring-2 ring-primary/30",
                  !active && !finished && "bg-muted text-muted-foreground",
                )}
                aria-label={t(`setup.steps.${id}`)}
              >
                {finished ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-px w-6 sm:w-10",
                    finished ? "bg-primary/50" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="reveal reveal-delay-2 space-y-3">
        {/* Step 1 — name */}
        <StepCard
          open={openStep === "name"}
          done={Boolean(done.name)}
          index={1}
          icon={Hash}
          title={t("setup.steps.name")}
          onToggle={() => toggleStep("name")}
        >
          <div className="space-y-3">
            <Input
              value={mark}
              onChange={(e) => {
                setMark(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""));
                setClaimed(false);
                setDone((d) => ({
                  ...d,
                  token: false,
                  settings: false,
                  install: false,
                }));
              }}
              className="h-11 font-mono text-center text-base"
              spellCheck={false}
              autoComplete="off"
            />
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={regenerateAll}
              >
                <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                {t("setup.name.random")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                onClick={() => void completeStep("name")}
              >
                {t("setup.next")}
              </Button>
            </div>
            <p className="text-center text-2xs text-muted-foreground">
              {baseUrl}/{mark || "…"}
            </p>
          </div>
        </StepCard>

        {/* Step 2 — token */}
        <StepCard
          open={openStep === "token"}
          done={Boolean(done.token)}
          index={2}
          icon={KeyRound}
          title={t("setup.steps.token")}
          onToggle={() => toggleStep("token")}
        >
          <div className="space-y-3">
            <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="break-all font-mono text-xs leading-relaxed">
                {writeToken}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void copy("token")}
              >
                {copied === "token" ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("setup.token.copy")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setStoredWriteToken(mark, writeToken);
                  downloadTokenBackup(mark, writeToken);
                  setTokenBackupAcknowledged(mark, true);
                  toast.success(t("setup.token.download"));
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t("setup.token.download")}
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-full"
                disabled={syncing}
                onClick={() => void completeStep("token")}
              >
                {syncing ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {t("setup.claiming")}
                  </>
                ) : (
                  t("setup.next")
                )}
              </Button>
            </div>
            <p className="flex items-start justify-center gap-1.5 text-center text-2xs text-muted-foreground">
              <Shield className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              {t("setup.token.hint")}
            </p>
          </div>
        </StepCard>

        {/* Step 3 — settings */}
        <StepCard
          open={openStep === "settings"}
          done={Boolean(done.settings)}
          index={3}
          icon={Settings2}
          title={t("setup.steps.settings")}
          onToggle={() => toggleStep("settings")}
        >
          <CollectionSettingsFields
            value={settings}
            onChange={(next) => {
              setSettings(next);
              setClaimed(false);
            }}
            disabled={syncing}
          />
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              disabled={syncing}
              onClick={() => void completeStep("settings")}
            >
              {syncing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {openStep === "token" ? t("setup.claiming") : t("setup.saving")}
                </>
              ) : (
                t("setup.next")
              )}
            </Button>
          </div>
        </StepCard>

        {/* Step 4 — install */}
        <StepCard
          open={openStep === "install"}
          done={Boolean(done.install)}
          index={4}
          icon={BookmarkPlus}
          title={t("setup.steps.install")}
          onToggle={() => toggleStep("install")}
        >
          <DragBookmarkletDemo className="mb-4" mark={mark} />

          <div className="space-y-3">
            <p className="text-center text-xs font-medium text-foreground">
              {t("setup.install.dragBoth")}
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              {/* 1. Bookmarklet — drag to bar */}
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-3">
                <span className="text-2xs font-semibold uppercase tracking-wider text-primary">
                  {t("setup.install.itemSave")}
                </span>
                <BookmarkletLink code={bookmarkletCode} className="inline-flex w-full justify-center">
                  <Button
                    size="sm"
                    className="h-10 w-full max-w-[16rem] cursor-grab rounded-full px-3 shadow-glow active:cursor-grabbing"
                    asChild
                  >
                    <span className="flex items-center justify-center gap-1.5 truncate">
                      <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t("setup.install.saveButton", { mark })}</span>
                    </span>
                  </Button>
                </BookmarkletLink>
                <p className="text-center text-2xs text-muted-foreground">
                  {t("setup.install.dragSaveHint")}
                </p>
              </div>

              {/* 2. Collection shortcut — drag normal link to bar */}
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-muted/30 px-3 py-3">
                <span className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("setup.install.itemOpen")}
                </span>
                <a
                  href={`/${mark}`}
                  draggable
                  className="inline-flex w-full max-w-[16rem] justify-center"
                  onClick={(e) => {
                    // Prefer drag-install; click opens after ensuring claim.
                    e.preventDefault();
                    void (async () => {
                      if (!claimed) {
                        const ok = await syncToServer();
                        if (!ok) return;
                      }
                      navigate(`/${mark}`);
                    })();
                  }}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 w-full cursor-grab rounded-full active:cursor-grabbing"
                    asChild
                  >
                    <span className="flex items-center justify-center gap-1.5 truncate">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{t("setup.install.openCollection")}</span>
                    </span>
                  </Button>
                </a>
                <p className="text-center text-2xs text-muted-foreground">
                  {t("setup.install.dragOpenHint")}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={() => void copy("code")}
              >
                {copied === "code" ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                {t("setup.install.copyCode")}
              </Button>
            </div>
          </div>
        </StepCard>
      </div>
    </div>
  );
}

function StepCard({
  open,
  done,
  index,
  icon: Icon,
  title,
  onToggle,
  children,
}: {
  open: boolean;
  done: boolean;
  index: number;
  icon: typeof Hash;
  title: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-border/70 bg-card/50 shadow-sm backdrop-blur-sm transition-shadow",
        open && "shadow-elevated ring-1 ring-primary/15",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/30"
        aria-expanded={open}
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
            done
              ? "bg-primary text-primary-foreground"
              : open
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground",
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" /> : index}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-display text-sm font-semibold tracking-tight">
            {title}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 px-4 py-4">{children}</div>
        </div>
      </div>
    </section>
  );
}
