import { useState } from "react";
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
  DialogClose,
} from "@/components/ui/dialog";
import { getDomain } from "@/shared/utils";
import type { BookmarkInstance } from "@/shared/types";
import { deleteBookmarkApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";

interface DialogDeleteProps {
  mark: string;
  bookmark: BookmarkInstance | null;
  writeToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookmarkDeleted: (uuid: string) => void;
}

export function DialogDelete({
  mark,
  bookmark,
  writeToken,
  open,
  onOpenChange,
  onBookmarkDeleted,
}: DialogDeleteProps) {
  const t = useTranslations("Components.BookmarkDialog");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onConfirm = async () => {
    if (!bookmark || !writeToken) {
      toast.error(t("errors.tokenRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteBookmarkApi({
        mark,
        token: writeToken,
        uuid: bookmark.uuid,
      });
      toast.success(t("deleteSuccess"));
      onBookmarkDeleted(bookmark.uuid);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.deleteFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!bookmark) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="h-4 w-4 text-destructive" />
            {t("deleteTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("deleteDescription", {
              title: bookmark.title || getDomain(bookmark.url),
            })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground">
          {t("deleteConfirmation")}
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              {t("cancel")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isSubmitting || !writeToken}
            onClick={onConfirm}
          >
            {isSubmitting && (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            )}
            {t("deleteButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
