import { BookmarkPlus, GripHorizontal } from "lucide-react";
import { useTranslations } from "@/client/i18n/context";
import { cn } from "@/shared/utils";

/** Looping micro-demo: drag a bookmarklet chip up into a fake bookmarks bar. */
export function DragBookmarkletDemo({ className }: { className?: string }) {
  const t = useTranslations("DocPage.setup.install");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-muted/50 to-card/40 p-4",
        className,
      )}
      aria-hidden
    >
      {/* Fake browser chrome */}
      <div className="rounded-xl border border-border/80 bg-background/90 shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
          <div className="ml-2 h-5 flex-1 rounded-md bg-muted/70" />
        </div>

        {/* Bookmarks bar drop target */}
        <div className="relative flex h-9 items-center gap-2 border-b border-dashed border-primary/35 bg-primary/5 px-3">
          <span className="text-2xs font-medium uppercase tracking-wider text-primary/80">
            {t("bookmarksBar")}
          </span>
          <div className="drag-demo-slot ml-auto flex h-6 min-w-[5.5rem] items-center justify-center rounded-md border border-dashed border-primary/40 bg-background/60 px-2">
            <span className="drag-demo-ghost text-2xs font-medium text-primary">
              {t("saveChip")}
            </span>
          </div>
        </div>

        {/* Page body + floating chip */}
        <div className="relative h-28 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.06),transparent_70%)]">
          <div className="absolute inset-x-6 top-4 h-2 rounded bg-muted/80" />
          <div className="absolute inset-x-6 top-9 h-2 w-2/3 rounded bg-muted/50" />
          <div className="absolute inset-x-6 top-14 h-2 w-1/2 rounded bg-muted/40" />

          <div className="drag-demo-chip absolute left-1/2 top-[3.6rem] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-primary/30 bg-primary px-3 py-1.5 text-2xs font-semibold text-primary-foreground shadow-glow">
            <GripHorizontal className="h-3 w-3 opacity-80" />
            <BookmarkPlus className="h-3 w-3" />
            {t("saveChip")}
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-2xs text-muted-foreground">
        {t("dragHint")}
      </p>
    </div>
  );
}
