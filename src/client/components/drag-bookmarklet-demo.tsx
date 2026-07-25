import { BookmarkPlus, ExternalLink, GripHorizontal } from "lucide-react";
import { useTranslations } from "@/client/i18n/context";
import { cn } from "@/shared/utils";

interface DragBookmarkletDemoProps {
  className?: string;
  /** Collection mark shown on the save chip */
  mark?: string;
}

/**
 * Looping micro-demo: drag two chips into a fake bookmarks bar —
 * 1) Save bookmarklet  2) Open collection shortcut
 */
export function DragBookmarkletDemo({
  className,
  mark,
}: DragBookmarkletDemoProps) {
  const t = useTranslations("DocPage.setup.install");
  const saveLabel = mark
    ? t("saveChipNamed", { mark: shortMark(mark) })
    : t("saveChip");
  const openLabel = t("openChip");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-muted/50 to-card/40 p-4",
        className,
      )}
      aria-hidden
    >
      <div className="drag-demo-stage rounded-xl border border-border/80 bg-background/90 shadow-sm">
        {/* Chrome */}
        <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
          <div className="ml-2 h-5 flex-1 rounded-md bg-muted/70" />
        </div>

        {/* Bookmarks bar — CSS grid keeps slots aligned with flying chips */}
        <div className="grid h-10 grid-cols-[auto_1fr_1fr] items-center gap-1.5 border-b border-dashed border-primary/35 bg-primary/5 px-2.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-primary/80">
            {t("bookmarksBar")}
          </span>

          <div className="drag-demo-slot drag-demo-slot-a flex h-7 min-w-0 items-center justify-center rounded-md border border-dashed border-primary/35 bg-background/50 px-1">
            <span className="drag-demo-ghost drag-demo-ghost-a flex min-w-0 items-center gap-0.5 truncate text-2xs font-medium text-primary">
              <BookmarkPlus className="h-3 w-3 shrink-0" />
              <span className="truncate">{saveLabel}</span>
            </span>
          </div>

          <div className="drag-demo-slot drag-demo-slot-b flex h-7 min-w-0 items-center justify-center rounded-md border border-dashed border-primary/35 bg-background/50 px-1">
            <span className="drag-demo-ghost drag-demo-ghost-b flex min-w-0 items-center gap-0.5 truncate text-2xs font-medium text-primary">
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{openLabel}</span>
            </span>
          </div>
        </div>

        {/* Page + chips. Chips use same 3-col grid so X aligns with slots. */}
        <div className="drag-demo-page relative h-36 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.06),transparent_70%)]">
          <div className="pointer-events-none absolute inset-x-6 top-4 h-2 rounded bg-muted/80" />
          <div className="pointer-events-none absolute inset-x-6 top-9 h-2 w-2/3 rounded bg-muted/50" />
          <div className="pointer-events-none absolute inset-x-6 top-14 h-2 w-1/2 rounded bg-muted/40" />

          <div className="absolute inset-x-0 bottom-3 grid grid-cols-[auto_1fr_1fr] items-end gap-1.5 px-2.5">
            <span className="w-[3.25rem]" />
            <div className="relative flex h-9 justify-center">
              <div className="drag-demo-chip drag-demo-chip-a absolute bottom-0 flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary px-2.5 py-1.5 text-2xs font-semibold text-primary-foreground shadow-glow">
                <GripHorizontal className="h-3 w-3 shrink-0 opacity-80" />
                <BookmarkPlus className="h-3 w-3 shrink-0" />
                <span className="max-w-[7.5rem] truncate sm:max-w-[9rem]">
                  {saveLabel}
                </span>
              </div>
            </div>
            <div className="relative flex h-9 justify-center">
              <div className="drag-demo-chip drag-demo-chip-b absolute bottom-0 flex max-w-full items-center gap-1 rounded-full border border-border/80 bg-card px-2.5 py-1.5 text-2xs font-semibold text-foreground shadow-sm">
                <GripHorizontal className="h-3 w-3 shrink-0 opacity-60" />
                <ExternalLink className="h-3 w-3 shrink-0 text-primary" />
                <span className="max-w-[7.5rem] truncate sm:max-w-[9rem]">
                  {openLabel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ol className="mt-3 space-y-1 text-2xs text-muted-foreground">
        <li className="flex items-start gap-1.5">
          <span className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
            1
          </span>
          <span>{t("tipSave", { mark: mark || "…" })}</span>
        </li>
        <li className="flex items-start gap-1.5">
          <span className="mt-px flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
            2
          </span>
          <span>{t("tipOpen")}</span>
        </li>
      </ol>
    </div>
  );
}

function shortMark(mark: string): string {
  if (mark.length <= 16) return mark;
  return `${mark.slice(0, 7)}…${mark.slice(-5)}`;
}
