import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCcw,
  Shield,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildBookmarkletCode } from "@/shared/bookmarklet";
import { generateWriteToken, isValidTokenFormat } from "@/shared/security";
import { claimCollectionApi, regenerateTokenApi } from "@/client/lib/api";
import {
  clearStoredWriteToken,
  downloadTokenBackup,
  getStoredWriteToken,
  isTokenBackupAcknowledged,
  parseTokenRecoveryFile,
  setStoredWriteToken,
  setTokenBackupAcknowledged,
} from "@/client/lib/token-store";
import { useTranslations } from "@/client/i18n/context";
import { BookmarkletLink } from "@/client/components/bookmarklet-link";
import { cn } from "@/shared/utils";

type Step =
  | "overview"
  | "paste"
  | "generate"
  | "rotate-confirm"
  | "rotate-backup"
  | "clear-confirm";

interface TokenManagerProps {
  mark: string;
  baseUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  writeToken: string | null;
  /** Server-issued once (migration) */
  issuedWriteToken?: string;
  onTokenReady: (token: string | null) => void;
}

export function TokenManager({
  mark,
  baseUrl,
  open,
  onOpenChange,
  writeToken,
  issuedWriteToken,
  onTokenReady,
}: TokenManagerProps) {
  const t = useTranslations("TokenManager");
  const [step, setStep] = useState<Step>("overview");
  const [token, setToken] = useState(writeToken || "");
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [backupAck, setBackupAck] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const stored = getStoredWriteToken(mark) || issuedWriteToken || writeToken || "";
    setToken(stored);
    setStep("overview");
    setRevealed(false);
    setPasteValue("");
    setPendingToken("");
    setBackupAck(isTokenBackupAcknowledged(mark));
    setBusy(false);

    if (issuedWriteToken) {
      setStoredWriteToken(mark, issuedWriteToken);
      onTokenReady(issuedWriteToken);
      setToken(issuedWriteToken);
      if (!isTokenBackupAcknowledged(mark)) {
        setPendingToken(issuedWriteToken);
        setStep("generate");
        setBackupAck(false);
      }
    }
  }, [open, mark, writeToken, issuedWriteToken, onTokenReady]);

  const bookmarklet = useMemo(() => {
    if (!token) return "";
    return buildBookmarkletCode(baseUrl, mark, token);
  }, [baseUrl, mark, token]);

  const copyToken = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(t("copied"));
    setTimeout(() => setCopied(false), 1500);
  };

  const saveAndClose = (next: string) => {
    setStoredWriteToken(mark, next);
    setToken(next);
    onTokenReady(next);
    setStep("overview");
  };

  const handlePasteSave = async () => {
    const trimmed = pasteValue.trim();
    if (!isValidTokenFormat(trimmed)) {
      toast.error(t("invalidToken"));
      return;
    }
    setBusy(true);
    try {
      // Verify ownership when collection exists; claim when it does not.
      await claimCollectionApi({ mark, token: trimmed });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/different write token/i.test(msg) || /Invalid write token/i.test(msg)) {
        toast.error(t("invalidToken"));
        setBusy(false);
        return;
      }
      // Other errors (rate limit, network): still block save so user retries
      toast.error(msg || t("invalidToken"));
      setBusy(false);
      return;
    }
    setStoredWriteToken(mark, trimmed);
    setTokenBackupAcknowledged(mark, true);
    setToken(trimmed);
    onTokenReady(trimmed);
    toast.success(t("tokenSaved"));
    setStep("overview");
    setBusy(false);
  };

  const handleGenerateConfirm = () => {
    if (!backupAck || !pendingToken) {
      toast.error(t("mustBackup"));
      return;
    }
    setTokenBackupAcknowledged(mark, true);
    saveAndClose(pendingToken);
    toast.success(t("tokenSaved"));
  };

  const handleRotateStart = () => {
    if (!token) {
      toast.error(t("needCurrentToken"));
      return;
    }
    setPendingToken(generateWriteToken());
    setBackupAck(false);
    setStep("rotate-confirm");
  };

  const handleRotateApply = async () => {
    if (!token) return;
    const next = pendingToken || generateWriteToken();
    if (!pendingToken) setPendingToken(next);
    setBusy(true);
    try {
      await regenerateTokenApi({
        mark,
        currentToken: token,
        newToken: next,
      });
      setPendingToken(next);
      setStep("rotate-backup");
      setBackupAck(false);
      toast.success(t("rotateSuccess"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("rotateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRotateFinish = () => {
    if (!backupAck || !pendingToken) {
      toast.error(t("mustBackup"));
      return;
    }
    setTokenBackupAcknowledged(mark, true);
    saveAndClose(pendingToken);
    toast.success(t("tokenSaved"));
    toast.message(t("reinstallBookmarklet"));
  };

  const handleClear = () => {
    clearStoredWriteToken(mark);
    setToken("");
    onTokenReady(null);
    setStep("overview");
    toast.message(t("cleared"));
  };

  const onRecoveryFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseTokenRecoveryFile(text);
      if (!parsed?.token || !isValidTokenFormat(parsed.token)) {
        toast.error(t("invalidRecoveryFile"));
        return;
      }
      if (parsed.mark && parsed.mark !== mark) {
        toast.warning(t("markMismatch", { fileMark: parsed.mark, mark }));
      }
      setPasteValue(parsed.token);
      setStep("paste");
      toast.success(t("recoveryLoaded"));
    } catch {
      toast.error(t("invalidRecoveryFile"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <Shield className="h-4 w-4" />
            </span>
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t("description", { mark })}
          </DialogDescription>
        </DialogHeader>

        {step === "overview" && (
          <div className="space-y-3">
            {token ? (
              <>
                {/* Token + primary tools */}
                <div className="overflow-hidden rounded-lg border border-border/70">
                  <div className="flex items-center gap-1 bg-muted/40 px-2.5 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <span className="text-2xs font-medium text-muted-foreground">
                          {t("currentToken")}
                        </span>
                        {!isTokenBackupAcknowledged(mark) && (
                          <span className="inline-flex items-center gap-0.5 text-2xs text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            {t("backupMissing")}
                          </span>
                        )}
                      </div>
                      <code className="block truncate font-mono text-xs leading-5">
                        {revealed ? token : maskToken(token)}
                      </code>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setRevealed((v) => !v)}
                      title={revealed ? t("hide") : t("reveal")}
                    >
                      {revealed ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => copyToken(token)}
                      title={t("copyToken")}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      title={t("downloadBackup")}
                      onClick={() => {
                        downloadTokenBackup(mark, token);
                        setBackupAck(true);
                        setTokenBackupAcknowledged(mark, true);
                        toast.success(t("backupDownloaded"));
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1 border-t border-border/60 px-1.5 py-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={handleRotateStart}
                    >
                      <RefreshCcw className="mr-1 h-3 w-3" />
                      {t("rotate")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => setStep("clear-confirm")}
                    >
                      {t("clearLocal")}
                    </Button>
                    <span className="ml-auto px-1.5 text-2xs text-muted-foreground">
                      {t("tokenWarningShort")}
                    </span>
                  </div>
                </div>

                {/* Bookmarklet — single compact row */}
                <div className="flex items-center gap-2.5 rounded-lg border border-border/70 px-2.5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-none">{t("bookmarklet")}</p>
                    <p className="mt-1 text-2xs text-muted-foreground">{t("bookmarkletHint")}</p>
                  </div>
                  <BookmarkletLink code={bookmarklet} className="shrink-0">
                    <Button size="sm" variant="secondary" className="h-8 max-w-[11rem] cursor-grab px-2.5" asChild>
                      <span className="truncate">{t("dragBookmarklet", { mark })}</span>
                    </Button>
                  </BookmarkletLink>
                </div>

                {/* Secondary: paste / restore */}
                <div className="border-t border-border/50 pt-2.5">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => {
                      setPasteValue("");
                      setStep("paste");
                    }}
                  >
                    <Upload className="h-3 w-3" />
                    {t("pasteRestore")}
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2 rounded-lg border border-dashed border-border/80 px-4 py-6 text-center">
                  <KeyRound className="mx-auto h-7 w-7 text-muted-foreground/45" />
                  <p className="text-sm text-muted-foreground">{t("noToken")}</p>
                </div>
                <Button
                  size="sm"
                  className="h-9 w-full"
                  onClick={() => {
                    setPasteValue("");
                    setStep("paste");
                  }}
                >
                  <Upload className="mr-1.5 h-3.5 w-3.5" />
                  {t("pasteRestore")}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "paste" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t("pasteDescription")}</p>
            <Input
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder={t("tokenPlaceholder")}
              className="h-9 font-mono text-xs"
              autoFocus
            />
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <Upload className="h-3.5 w-3.5" />
              {t("loadRecoveryFile")}
              <input
                type="file"
                accept=".json,.txt,application/json,text/plain"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onRecoveryFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button size="sm" variant="outline" onClick={() => setStep("overview")}>
                {t("back")}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void handlePasteSave()}>
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {t("saveToken")}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "generate" && (
          <BackupGate
            t={t}
            mark={mark}
            pendingToken={pendingToken}
            backupAck={backupAck}
            setBackupAck={setBackupAck}
            onCopy={() => copyToken(pendingToken)}
            warning={t("generateNewWarning")}
            onBack={() => setStep("overview")}
            onConfirm={handleGenerateConfirm}
            confirmLabel={t("confirmSave")}
          />
        )}

        {step === "rotate-confirm" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {t("rotateTitle")}
              </p>
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                <li className="flex gap-1.5">
                  <span className="text-amber-700/70 dark:text-amber-400/70">·</span>
                  {t("rotatePoint1")}
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-700/70 dark:text-amber-400/70">·</span>
                  {t("rotatePoint2")}
                </li>
                <li className="flex gap-1.5">
                  <span className="text-amber-700/70 dark:text-amber-400/70">·</span>
                  {t("rotatePoint3")}
                </li>
              </ul>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button size="sm" variant="outline" onClick={() => setStep("overview")}>
                {t("back")}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void handleRotateApply()}
              >
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {t("rotateConfirm")}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "rotate-backup" && (
          <BackupGate
            t={t}
            mark={mark}
            pendingToken={pendingToken}
            backupAck={backupAck}
            setBackupAck={setBackupAck}
            onCopy={() => copyToken(pendingToken)}
            warning={t("rotateBackupWarning")}
            onBack={() => {
              // Token already rotated on server — must finish backup
              toast.error(t("mustFinishRotateBackup"));
            }}
            onConfirm={handleRotateFinish}
            confirmLabel={t("finishRotate")}
            backDisabled
          />
        )}

        {step === "clear-confirm" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t("clearWarning")}</p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button size="sm" variant="outline" onClick={() => setStep("overview")}>
                {t("back")}
              </Button>
              <Button size="sm" variant="destructive" onClick={handleClear}>
                {t("clearConfirm")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackupGate({
  t,
  mark,
  pendingToken,
  backupAck,
  setBackupAck,
  onCopy,
  warning,
  onBack,
  onConfirm,
  confirmLabel,
  backDisabled,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string;
  mark: string;
  pendingToken: string;
  backupAck: boolean;
  setBackupAck: (v: boolean) => void;
  onCopy: () => void;
  warning: string;
  onBack: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  backDisabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{warning}</p>
      <div className="overflow-hidden rounded-lg border border-border/70">
        <div className="bg-muted/40 px-2.5 py-2">
          <p className="mb-0.5 text-2xs font-medium text-muted-foreground">
            {t("newToken")}
          </p>
          <code className="block break-all font-mono text-xs leading-5">{pendingToken}</code>
        </div>
        <div className="flex items-center gap-1 border-t border-border/60 px-1.5 py-1">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onCopy}>
            <Copy className="mr-1 h-3 w-3" />
            {t("copyToken")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={() => {
              downloadTokenBackup(mark, pendingToken);
              setBackupAck(true);
            }}
          >
            <Download className="mr-1 h-3 w-3" />
            {t("downloadBackup")}
          </Button>
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={backupAck}
          onChange={(e) => setBackupAck(e.target.checked)}
        />
        <span>{t("ackBackup")}</span>
      </label>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          size="sm"
          variant="outline"
          onClick={onBack}
          disabled={backDisabled}
          className={cn(backDisabled && "invisible")}
        >
          {t("back")}
        </Button>
        <Button size="sm" disabled={!backupAck} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </div>
  );
}

function maskToken(token: string): string {
  if (token.length <= 10) return "••••••••";
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}
