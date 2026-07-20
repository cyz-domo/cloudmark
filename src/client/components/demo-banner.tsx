import { Link } from "react-router";
import { isDemoMark } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/client/i18n/context";

export function DemoBanner({ mark }: { mark: string }) {
  const t = useTranslations("BookmarksPage");
  if (!isDemoMark(mark)) return null;

  return (
    <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="font-medium text-amber-700 dark:text-amber-400">
            {t("demoMode")}
          </span>
          <span className="ml-2 text-muted-foreground">
            {t("demoDescription")}
          </span>
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 shrink-0">
          <Link to="/doc">{t("createOwn")}</Link>
        </Button>
      </div>
    </div>
  );
}
