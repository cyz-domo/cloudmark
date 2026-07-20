import { memo, type MouseEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { BookmarkInstance } from "@/shared/types";
import { cn, getDomain } from "@/shared/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/client/i18n/context";

interface BookmarkRowProps {
  bookmark: BookmarkInstance;
  /** Multi-select membership */
  selected: boolean;
  /** Keyboard focus cursor */
  focused: boolean;
  canWrite: boolean;
  onSelect: (event: MouseEvent) => void;
  onToggle: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/** Shared grid template — must match collection list header */
export const BOOKMARK_ROW_GRID =
  "grid-cols-[1rem_1.25rem_minmax(0,1fr)_auto] sm:grid-cols-[1rem_1.25rem_minmax(0,1fr)_7rem_5.5rem_5.25rem]";

export const BookmarkRow = memo(function BookmarkRow({
  bookmark,
  selected,
  focused,
  canWrite,
  onSelect,
  onToggle,
  onOpen,
  onEdit,
  onDelete,
}: BookmarkRowProps) {
  const t = useTranslations("Components.BookmarkCard");
  const domain = getDomain(bookmark.url);
  const date = formatDistanceToNow(new Date(bookmark.createdAt), {
    addSuffix: true,
  });

  return (
    <div
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      data-selected={selected}
      data-focused={focused}
      data-uuid={bookmark.uuid}
      className={cn(
        "bookmark-row group relative grid cursor-pointer items-center gap-x-2 border-b border-border/60 px-2 py-2 text-sm transition-all duration-150 sm:gap-x-3 sm:px-3",
        BOOKMARK_ROW_GRID,
        "hover:bg-muted/60",
        selected &&
          "z-[1] bg-primary/8 shadow-[inset_3px_0_0_0_hsl(var(--primary))]",
        focused && "ring-1 ring-inset ring-primary/40",
        selected && focused && "bg-primary/12 ring-primary/50",
      )}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      {/* Checkbox */}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? t("deselect") : t("select")}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center justify-self-center rounded border transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 bg-background hover:border-primary/60",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>

      {/* Favicon */}
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center justify-self-center overflow-hidden rounded-sm transition-colors",
          selected || focused
            ? "bg-primary/15 ring-1 ring-primary/30"
            : "bg-muted",
        )}
        aria-hidden
      >
        {bookmark.favicon ? (
          <img
            src={bookmark.favicon}
            alt=""
            className="h-4 w-4"
            loading="lazy"
            width={16}
            height={16}
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                "/placeholder.svg?height=16&width=16";
            }}
          />
        ) : (
          <ExternalLink
            className={cn(
              "h-3 w-3",
              selected || focused ? "text-primary" : "text-muted-foreground",
            )}
          />
        )}
      </div>

      {/* Title / URL / description stack */}
      <div className="min-w-0 flex flex-col gap-0.5 py-0.5">
        <span
          className={cn(
            "truncate leading-snug",
            selected || focused
              ? "font-semibold text-foreground"
              : "font-medium text-foreground",
          )}
          title={bookmark.title}
        >
          {bookmark.title}
        </span>
        <span
          className="truncate text-2xs leading-snug text-muted-foreground"
          title={bookmark.url}
        >
          {domain}
        </span>
        {bookmark.description ? (
          <p
            className="truncate text-2xs leading-snug text-muted-foreground/80"
            title={bookmark.description}
          >
            {bookmark.description}
          </p>
        ) : null}
      </div>

      {/* Category */}
      <Badge
        variant="outline"
        className={cn(
          "hidden max-w-full justify-self-start truncate px-1.5 py-0 text-2xs font-normal sm:inline-flex",
          (selected || focused) &&
            "border-primary/30 bg-primary/5 text-foreground",
        )}
      >
        {bookmark.category}
      </Badge>

      {/* Date */}
      <span
        className={cn(
          "hidden justify-self-end whitespace-nowrap text-2xs tabular-nums md:inline",
          selected || focused
            ? "text-foreground/70"
            : "text-muted-foreground",
        )}
      >
        {date}
      </span>

      {/* Actions */}
      <div
        className={cn(
          "flex shrink-0 items-center justify-end gap-0.5 justify-self-end transition-opacity",
          selected || focused
            ? "opacity-100"
            : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={t("visit")}
          onClick={onOpen}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={t("edit")}
          disabled={!canWrite}
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          title={t("delete")}
          disabled={!canWrite}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
});
