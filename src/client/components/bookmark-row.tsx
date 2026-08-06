import { memo, useRef, type MouseEvent, type PointerEvent } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ExternalLink,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { BookmarkInstance } from "@/shared/types";
import { cn, getDomain } from "@/shared/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/client/i18n/context";
import { BookmarkIcon } from "@/client/components/bookmark-icon";

/** Touch-primary device: reorder via arrows, never whole-row HTML5 drag */
const IS_COARSE_POINTER =
  typeof window !== "undefined" &&
  window.matchMedia("(pointer: coarse)").matches;

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
  reorderable?: boolean;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  dragging?: boolean;
  dragOver?: boolean;
  /** Touch reorder mode: show ▲▼ arrows and lift the whole-row drag */
  reorderMode?: boolean;
  /** Which move directions are possible for this row ("both" | "up" | "down" | null) */
  moveDirection?: "up" | "down" | "both" | null;
  onMove?: (direction: "up" | "down") => void;
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
  reorderable,
  onPointerDown,
  dragging,
  dragOver,
  reorderMode,
  moveDirection,
  onMove,
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
      data-selected={selected || undefined}
      data-focused={focused || undefined}
      data-uuid={bookmark.uuid}
      className={cn(
        "bookmark-row group relative grid cursor-pointer items-center gap-x-2 border-b border-border/50 px-2 py-2.5 text-sm sm:gap-x-3 sm:px-3",
        BOOKMARK_ROW_GRID,
        "hover:bg-muted/45",
        // Desktop: pointer-drag reorder (codex) — touch-none lets the row
        // claim the gesture. Mobile: a finger drag must always scroll the
        // list, never reorder — reorder happens via ▲▼ arrows in reorder mode.
        reorderable && !IS_COARSE_POINTER && "select-none touch-none",
        reorderable && IS_COARSE_POINTER && "touch-action:pan-y",
        // Selected = membership in selection set (checkbox / multi)
        selected && "is-selected",
        // Focused = keyboard/mouse cursor — distinct from selection
        focused && "is-focused",
        reorderable && !IS_COARSE_POINTER && "cursor-grab active:cursor-grabbing",
        dragging && "z-10 scale-[1.01] bg-primary/10 opacity-55 shadow-lg ring-2 ring-primary/35",
        dragOver && "translate-y-1 border-t-2 border-primary bg-primary/8 shadow-[0_-6px_18px_-12px_hsl(var(--primary))]",
      )}
      // Desktop: codex pointer-drag reorder. Mobile: no row-level drag —
      // swipe scrolls, reorder is via ▲▼ arrows.
      onPointerDown={!IS_COARSE_POINTER ? onPointerDown : undefined}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.preventDefault();
        onOpen();
      }}
    >
      {reorderable && !IS_COARSE_POINTER ? <GripVertical className="pointer-events-none absolute left-0 h-4 w-4 -translate-x-0.5 text-muted-foreground/60" aria-label="Drag to reorder" /> : null}
      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={selected ? t("deselect") : t("select")}
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center justify-self-center rounded-[4px] border transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground shadow-sm"
            : "border-muted-foreground/35 bg-background hover:border-primary/55",
          focused && !selected && "border-primary/50",
          reorderable && "translate-x-2",
        )}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onToggle();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>

      {/* Favicon / custom icon */}
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center justify-self-center overflow-hidden rounded-md transition-colors",
          selected
            ? "bg-primary/12 ring-1 ring-primary/25"
            : focused
              ? "bg-muted ring-1 ring-border"
              : "bg-muted/80",
        )}
        aria-hidden
      >
        <BookmarkIcon
          favicon={bookmark.favicon}
          title={bookmark.title}
          className="text-sm"
          imgClassName="h-4 w-4"
        />
      </div>

      {/* Title / URL / description stack */}
      <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
        <span
          className={cn(
            "truncate leading-snug",
            selected || focused ? "font-semibold text-foreground" : "font-medium text-foreground",
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
          selected && "border-primary/25 bg-primary/5 text-foreground",
        )}
      >
        {bookmark.category}
      </Badge>

      {/* Date */}
      <span
        className={cn(
          "hidden justify-self-end whitespace-nowrap text-2xs tabular-nums md:inline",
          selected ? "text-foreground/70" : "text-muted-foreground",
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
        {reorderMode && moveDirection ? (
          <span className="mr-0.5 flex shrink-0 flex-col">
            <MoveStepButton
              direction="up"
              disabled={moveDirection === "down"}
              label={t("moveUp")}
              onMove={onMove}
            />
            <MoveStepButton
              direction="down"
              disabled={moveDirection === "up"}
              label={t("moveDown")}
              onMove={onMove}
            />
          </span>
        ) : null}
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

/**
 * One ▲/▼ step. Holding it down moves repeatedly (with a small initial
 * delay), which makes long-distance reordering on touch feasible.
 */
function MoveStepButton({
  direction,
  disabled,
  label,
  onMove,
}: {
  direction: "up" | "down";
  disabled?: boolean;
  label: string;
  onMove?: (direction: "up" | "down") => void;
}) {
  const timer = useRef<number | null>(null);
  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const press = () => {
    if (disabled) return;
    onMove?.(direction);
    timer.current = window.setTimeout(() => {
      timer.current = window.setInterval(() => onMove?.(direction), 110);
    }, 420);
  };
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={cn(
        "flex h-4 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors",
        disabled
          ? "cursor-default opacity-30"
          : "hover:bg-muted hover:text-foreground active:bg-muted active:text-foreground",
      )}
      onPointerDown={press}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onPointerMove={(e) => {
        // Dragging the finger off the button cancels the repeat
        if (e.pressure === 0) cancel();
      }}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}
