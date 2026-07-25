import { useState } from "react";
import { KeyRound, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidTokenFormat } from "@/shared/security";
import {
  parseTokenRecoveryFile,
  setStoredWriteToken,
  setTokenBackupAcknowledged,
} from "@/client/lib/token-store";
import { useTranslations } from "@/client/i18n/context";
import { cn } from "@/shared/utils";

interface TokenUnlockFormProps {
  mark: string;
  /** Validate + persist. Throw or return false on failure. */
  onUnlock: (token: string) => Promise<void>;
  submitLabel?: string;
  initialToken?: string;
  autoFocus?: boolean;
  className?: string;
  compact?: boolean;
}

/**
 * Shared paste / recovery-file form for:
 * - private collection gate
 * - existing public collection without a local write token
 */
export function TokenUnlockForm({
  mark,
  onUnlock,
  submitLabel,
  initialToken = "",
  autoFocus,
  className,
  compact,
}: TokenUnlockFormProps) {
  const t = useTranslations("TokenUnlock");
  const [value, setValue] = useState(initialToken);
  const [busy, setBusy] = useState(false);

  const submit = async (raw: string) => {
    const trimmed = raw.trim();
    if (!isValidTokenFormat(trimmed)) {
      toast.error(t("invalidToken"));
      return;
    }
    setBusy(true);
    try {
      await onUnlock(trimmed);
      setStoredWriteToken(mark, trimmed);
      setTokenBackupAcknowledged(mark, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("invalidToken"));
    } finally {
      setBusy(false);
    }
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
      setValue(parsed.token);
      toast.success(t("recoveryLoaded"));
    } catch {
      toast.error(t("invalidRecoveryFile"));
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("flex flex-col gap-2", !compact && "sm:flex-row")}>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value.trim())}
          placeholder={t("placeholder")}
          className={cn("font-mono text-xs", compact ? "h-9" : "h-10")}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit(value);
            }
          }}
        />
        <Button
          type="button"
          className={cn(compact ? "h-9" : "h-10", "shrink-0 rounded-full")}
          disabled={busy || !value}
          onClick={() => void submit(value)}
        >
          {busy ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <KeyRound className="mr-1.5 h-4 w-4" />
          )}
          {submitLabel ?? t("submit")}
        </Button>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-2xs text-muted-foreground transition-colors hover:text-foreground">
        <Upload className="h-3 w-3" />
        {t("loadRecoveryFile")}
        <input
          type="file"
          accept=".json,.txt,application/json,text/plain"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onRecoveryFile(f);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
