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
import { regenerateTokenApi } from "@/client/lib/api";
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

  const handlePasteSave = () => {
    const trimmed = pasteValue.trim();
    if (!isValidTokenFormat(trimmed)) {
      toast.error(t("invalidToken"));
      return;
    }
    setStoredWriteToken(mark, trimmed);
    setTokenBackupAcknowledged(mark, true);
    setToken(trimmed);
    onTokenReady(trimmed);
    toast.success(t("tokenSaved"));
    setStep("overview");
  };

  const handleGenerateStart = () => {
    if (token) {
      // Existing local token — generating a new one without rotate will NOT unlock an owned collection
      setStep("generate");
      setPendingToken(generateWriteToken());
      setBackupAck(false);
      return;
    }
    setPendingToken(generateWriteToken());
    setBackupAck(false);
    setStep("generate");
  };

  const handleGenerateConfirm = () => {
    if (!backupAck || !pendingToken) {
      toast.error(t("mustBackup"));
      return;
    }
    setTokenBackupAcknowledged(mark, true);
    saveAndClose(pendingToken);
    toast.success(t("tokenSaved"));
    toast.message(t("claimHint"));
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-4 w-4" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description", { mark })}</DialogDescription>
        </DialogHeader>

        {step === "overview" && (
          <div className="space-y-4">
            {token ? (
              <>
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("currentToken")}
                    </span>
                    {!isTokenBackupAcknowledged(mark) && (
                      <span className="flex items-center gap-1 text-2xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        {t("backupMissing")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 font-mono text-2xs">
                      {revealed ? token : maskToken(token)}
                    </code>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
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
                      className="h-8 w-8 shrink-0"
                      onClick={() => copyToken(token)}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-2xs text-amber-700 dark:text-amber-400">
                    {t("tokenWarning")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      downloadTokenBackup(mark, token);
                      setBackupAck(true);
                      toast.success(t("backupDownloaded"));
                    }}
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {t("downloadBackup")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={handleRotateStart}
                  >
                    <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                    {t("rotate")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-destructive"
                    onClick={() => setStep("clear-confirm")}
                  >
                    {t("clearLocal")}
                  </Button>
                </div>

                <div className="space-y-1.5 rounded-md border border-border/60 p-3">
                  <p className="text-xs font-medium">{t("bookmarklet")}</p>
                  <BookmarkletLink code={bookmarklet} className="inline-flex">
                    <Button size="sm" variant="secondary" className="h-8 cursor-grab" asChild>
                      <span>{t("dragBookmarklet", { mark })}</span>
                    </Button>
                  </BookmarkletLink>
                  <p className="text-2xs text-muted-foreground">
                    {t("bookmarkletHint")}
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-3 rounded-md border border-dashed border-border p-4 text-center">
                <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("noToken")}</p>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="sm"
                className="h-9"
                variant={token ? "outline" : "default"}
                onClick={() => {
                  setPasteValue("");
                  setStep("paste");
                }}
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                {t("pasteRestore")}
              </Button>
              <Button
                size="sm"
                className="h-9"
                variant="outline"
                onClick={handleGenerateStart}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                {token ? t("generateLocal") : t("generateNew")}
              </Button>
            </div>
            {token && (
              <p className="text-2xs text-muted-foreground">{t("generateLocalHint")}</p>
            )}
          </div>
        )}

        {step === "paste" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("pasteDescription")}</p>
            <Input
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              placeholder={t("tokenPlaceholder")}
              className="h-9 font-mono text-xs"
              autoFocus
            />
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
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
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button size="sm" variant="outline" onClick={() => setStep("overview")}>
                {t("back")}
              </Button>
              <Button size="sm" onClick={handlePasteSave}>
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
            warning={token ? t("generateLocalWarning") : t("generateNewWarning")}
            onBack={() => setStep("overview")}
            onConfirm={handleGenerateConfirm}
            confirmLabel={t("confirmSave")}
          />
        )}

        {step === "rotate-confirm" && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {t("rotateTitle")}
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-muted-foreground">
                <li>{t("rotatePoint1")}</li>
                <li>{t("rotatePoint2")}</li>
                <li>{t("rotatePoint3")}</li>
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
            <p className="text-sm text-muted-foreground">{t("clearWarning")}</p>
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
      <p className="text-sm text-muted-foreground">{warning}</p>
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="mb-1 text-2xs font-medium uppercase text-muted-foreground">
          {t("newToken")}
        </p>
        <code className="block break-all font-mono text-xs">{pendingToken}</code>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-8" onClick={onCopy}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          {t("copyToken")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => {
            downloadTokenBackup(mark, pendingToken);
            setBackupAck(true);
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t("downloadBackup")}
        </Button>
      </div>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1"
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
