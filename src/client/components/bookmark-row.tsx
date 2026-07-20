import { memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import type { BookmarkInstance } from "@/shared/types";
import { cn, getDomain } from "@/shared/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/client/i18n/context";

interface BookmarkRowProps {
  bookmark: BookmarkInstance;
  selected: boolean;
  canWrite: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export const BookmarkRow = memo(function BookmarkRow({
  bookmark,
  selected,
  canWrite,
  onSelect,
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
      data-uuid={bookmark.uuid}
      className={cn(
        "bookmark-row group grid cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border/60 px-2 py-1.5 text-sm transition-colors sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,8rem)_auto_auto] sm:gap-3 sm:px-3",
        "hover:bg-muted/50",
        selected && "bg-accent/80",
      )}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-muted">
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
          <ExternalLink className="h-3 w-3 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate font-medium leading-tight" title={bookmark.title}>
            {bookmark.title}
          </span>
          <span
            className="hidden truncate text-2xs text-muted-foreground sm:inline"
            title={bookmark.url}
          >
            {domain}
          </span>
        </div>
        {bookmark.description ? (
          <p
            className="truncate text-2xs text-muted-foreground"
            title={bookmark.description}
          >
            {bookmark.description}
          </p>
        ) : null}
      </div>

      <Badge
        variant="outline"
        className="hidden max-w-[8rem] truncate px-1.5 py-0 text-2xs font-normal sm:inline-flex"
      >
        {bookmark.category}
      </Badge>

      <span className="hidden whitespace-nowrap text-2xs text-muted-foreground tabular-nums md:inline">
        {date}
      </span>

      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          selected && "sm:opacity-100",
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
