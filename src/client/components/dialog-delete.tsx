import { useCallback, useEffect, useRef, useState } from "react";
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
import { deleteBookmarksApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";

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
  const submittingRef = useRef(false);

  const count = bookmarks.length;
  const first = bookmarks[0] ?? null;

  // Keep latest props/state for key handlers (avoid stale closures)
  const stateRef = useRef({
    mark,
    bookmarks,
    writeToken,
    isSubmitting,
    t,
    onOpenChange,
    onBookmarksDeleted,
  });
  stateRef.current = {
    mark,
    bookmarks,
    writeToken,
    isSubmitting,
    t,
    onOpenChange,
    onBookmarksDeleted,
  };

  useEffect(() => {
    submittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => cancelRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const onCancel = useCallback(() => {
    if (submittingRef.current) return;
    stateRef.current.onOpenChange(false);
  }, []);

  const onConfirm = useCallback(async () => {
    const s = stateRef.current;
    if (submittingRef.current) return;
    if (!s.bookmarks.length || !s.writeToken) {
      toast.error(s.t("errors.tokenRequired"));
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const uuids = s.bookmarks.map((b) => b.uuid);
      const deleted: string[] = [];
      let failed = 0;
      for (let i = 0; i < uuids.length; i += 100) {
        const chunk = uuids.slice(i, i + 100);
        try { await deleteBookmarksApi({ mark: s.mark, token: s.writeToken!, uuids: chunk }); deleted.push(...chunk); }
        catch { failed += chunk.length; }
      }
      if (deleted.length > 0) {
        s.onBookmarksDeleted(deleted);
        toast.success(
          deleted.length === 1
            ? s.t("deleteSuccess")
            : s.t("deleteSuccessMulti", { count: deleted.length }),
        );
      }
      if (failed > 0) {
        toast.error(s.t("errors.deleteFailedMulti", { count: failed }));
        return;
      }
      s.onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : s.t("errors.deleteFailed"));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }, []);

  // Capture-phase listener so Radix focus trap / stopPropagation cannot swallow keys
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (key === "d" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        void onConfirm();
        return;
      }

      if (key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onCancel();
        return;
      }

      if (key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

    // Capture on document so we run before Dialog / button handlers
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onConfirm, onCancel]);

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
        // Prevent focused Cancel button from also firing on Enter (we handle it)
        onKeyDown={(e) => {
          if (
            e.key === "d" ||
            e.key === "D" ||
            e.key === "Enter" ||
            e.key === "Escape"
          ) {
            e.preventDefault();
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
