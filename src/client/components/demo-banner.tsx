import { Link } from "react-router";
import { FlaskConical, ArrowRight } from "lucide-react";
import { isDemoMark } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/client/i18n/context";

export function DemoBanner({ mark }: { mark: string }) {
  const t = useTranslations("BookmarksPage");
  if (!isDemoMark(mark)) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-3.5 py-2.5 text-sm shadow-sm">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400">
            <FlaskConical className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {t("demoMode")}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground sm:mt-0 sm:ml-2 sm:inline">
              {t("demoDescription")}
            </span>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-8 shrink-0 rounded-full border-amber-500/30 bg-background/60"
        >
          <Link to="/doc" className="flex items-center gap-1.5">
            {t("createOwn")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
