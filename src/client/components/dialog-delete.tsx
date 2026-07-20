import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { getDomain } from "@/shared/utils";
import type { BookmarkInstance } from "@/shared/types";
import { deleteBookmarkApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";
import { useHotkeys } from "@/client/hooks/use-hotkeys";

interface DialogDeleteProps {
  mark: string;
  /** One or more bookmarks to delete */
  bookmarks: BookmarkInstance[];
  writeToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookmarksDeleted: (uuids: string[]) => void;
}

export function DialogDelete({
  mark,
  bookmarks,
  writeToken,
  open,
  onOpenChange,
  onBookmarksDeleted,
}: DialogDeleteProps) {
  const t = useTranslations("Components.BookmarkDialog");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const count = bookmarks.length;
  const first = bookmarks[0] ?? null;

  useEffect(() => {
    if (open) {
      // Prefer cancel as default action for Enter (browser button focus)
      const id = requestAnimationFrame(() => cancelRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const onCancel = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const onConfirm = async () => {
    if (!bookmarks.length || !writeToken) {
      toast.error(t("errors.tokenRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const uuids = bookmarks.map((b) => b.uuid);
      const results = await Promise.allSettled(
        uuids.map((uuid) =>
          deleteBookmarkApi({ mark, token: writeToken, uuid }),
        ),
      );
      const deleted: string[] = [];
      let failed = 0;
      results.forEach((r, i) => {
        if (r.status === "fulfilled") deleted.push(uuids[i]!);
        else failed += 1;
      });
      if (deleted.length > 0) {
        onBookmarksDeleted(deleted);
        toast.success(
          deleted.length === 1
            ? t("deleteSuccess")
            : t("deleteSuccessMulti", { count: deleted.length }),
        );
      }
      if (failed > 0) {
        toast.error(t("errors.deleteFailedMulti", { count: failed }));
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.deleteFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  useHotkeys(
    [
      {
        key: "d",
        allowInInput: true,
        handler: () => {
          void onConfirm();
        },
      },
      {
        key: "Enter",
        allowInInput: true,
        handler: () => {
          onCancel();
        },
      },
      {
        key: "Escape",
        allowInInput: true,
        handler: () => {
          onCancel();
        },
      },
    ],
    open && !isSubmitting,
  );

  if (!first) return null;

  const description =
    count === 1
      ? t("deleteDescription", {
          title: first.title || getDomain(first.url),
        })
      : t("deleteDescriptionMulti", { count });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSubmitting) onOpenChange(next);
      }}
    >
      <DialogContent
        className="sm:max-w-[400px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          cancelRef.current?.focus();
        }}
        onKeyDown={(e) => {
          // Stop radix/dialog default Enter-on-focused-button from fighting us
          if (e.key === "d" || e.key === "D" || e.key === "Enter") {
            e.stopPropagation();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="h-4 w-4 text-destructive" />
            {count === 1 ? t("deleteTitle") : t("deleteTitleMulti")}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">
          {t("deleteConfirmation")}
        </p>
        {count > 1 && (
          <ul className="max-h-28 space-y-0.5 overflow-y-auto rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-2xs text-muted-foreground">
            {bookmarks.slice(0, 12).map((b) => (
              <li key={b.uuid} className="truncate">
                {b.title || getDomain(b.url)}
              </li>
            ))}
            {count > 12 && <li>… +{count - 12}</li>}
          </ul>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            {t("cancel")}
            <kbd className="ml-1.5">↵</kbd>
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isSubmitting || !writeToken}
            onClick={() => void onConfirm()}
          >
            {isSubmitting && (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            )}
            {count === 1 ? t("deleteButton") : t("deleteButtonMulti", { count })}
            <kbd className="ml-1.5 border-destructive-foreground/30 bg-destructive-foreground/10 text-destructive-foreground">
              d
            </kbd>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
