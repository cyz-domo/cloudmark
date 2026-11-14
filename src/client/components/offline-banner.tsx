import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/client/i18n/context";

export function OfflineBanner({
  cachedAt,
  retrying,
  onRetry,
}: {
  cachedAt: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("BookmarksPage");
  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-3.5 py-2.5 text-sm shadow-sm">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <WifiOff className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {t("offlineTitle")}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground sm:mt-0 sm:ml-2 sm:inline">
              {t("offlineDescription", {
                time: new Date(cachedAt).toLocaleString(),
              })}
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 rounded-full border-amber-500/30 bg-background/60"
          disabled={retrying}
          onClick={onRetry}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
          {t("offlineRetry")}
        </Button>
      </div>
    </div>
  );
}