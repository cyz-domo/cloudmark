import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Tag, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { BookmarkInstance } from "@/shared/types";
import { getDomain } from "@/shared/utils";
import { CATEGORY_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from "@/shared/constants";
import { updateBookmarkApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";

type CategoryMode = "keep" | "set";
type DescriptionMode = "keep" | "set" | "clear" | "append";

interface DialogBulkEditProps {
  mark: string;
  bookmarks: BookmarkInstance[];
  categories: string[];
  writeToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookmarksUpdated: (bookmarks: BookmarkInstance[]) => void;
}

export function DialogBulkEdit({
  mark,
  bookmarks,
  categories,
  writeToken,
  open,
  onOpenChange,
  onBookmarksUpdated,
}: DialogBulkEditProps) {
  const t = useTranslations("Components.BulkEdit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryMode, setCategoryMode] = useState<CategoryMode>("keep");
  const [category, setCategory] = useState(categories[0] || "default");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [descriptionMode, setDescriptionMode] =
    useState<DescriptionMode>("keep");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setIsSubmitting(false);
    setCategoryMode("keep");
    setDescriptionMode("keep");
    setDescription("");
    setIsCreatingCategory(false);
    setNewCategory("");
    // Default category: shared category if all same, else first list item
    const cats = new Set(bookmarks.map((b) => b.category));
    if (cats.size === 1) {
      setCategory([...cats][0]!);
    } else {
      setCategory(categories[0] || "default");
    }
  }, [open, bookmarks, categories]);

  const count = bookmarks.length;
  if (count === 0) return null;

  const resolvedCategory = isCreatingCategory
    ? newCategory.trim()
    : category.trim();

  const applyDescription = (current?: string): string | undefined => {
    switch (descriptionMode) {
      case "keep":
        return current;
      case "clear":
        return undefined;
      case "set":
        return description.slice(0, DESCRIPTION_MAX_LENGTH) || undefined;
      case "append": {
        const extra = description.trim();
        if (!extra) return current;
        const base = current?.trim() ? `${current.trim()}\n` : "";
        return `${base}${extra}`.slice(0, DESCRIPTION_MAX_LENGTH);
      }
      default:
        return current;
    }
  };

  const hasChanges =
    categoryMode === "set" ||
    descriptionMode === "clear" ||
    descriptionMode === "set" ||
    descriptionMode === "append";

  const onSubmit = async () => {
    if (!writeToken) {
      toast.error(t("errors.tokenRequired"));
      return;
    }
    if (!hasChanges) {
      toast.message(t("noChanges"));
      return;
    }
    if (categoryMode === "set" && !resolvedCategory) {
      toast.error(t("errors.categoryRequired"));
      return;
    }
    if (
      categoryMode === "set" &&
      resolvedCategory.length > CATEGORY_MAX_LENGTH
    ) {
      toast.error(t("errors.categoryTooLong"));
      return;
    }

    setIsSubmitting(true);
    const updated: BookmarkInstance[] = [];
    let failed = 0;

    try {
      const results = await Promise.allSettled(
        bookmarks.map(async (b) => {
          const nextCategory =
            categoryMode === "set" ? resolvedCategory : b.category;
          const nextDescription = applyDescription(b.description);
          const result = await updateBookmarkApi({
            mark,
            token: writeToken,
            uuid: b.uuid,
            url: b.url,
            title: b.title,
            description: nextDescription,
            category: nextCategory,
          });
          return result;
        }),
      );

      for (const r of results) {
        if (r.status === "fulfilled") updated.push(r.value);
        else failed += 1;
      }

      if (updated.length > 0) {
        onBookmarksUpdated(updated);
        toast.success(t("success", { count: updated.length }));
      }
      if (failed > 0) {
        toast.error(t("errors.partialFailed", { count: failed }));
      }
      if (updated.length > 0) onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Pencil className="h-4 w-4" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description", { count })}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-24 space-y-0.5 overflow-y-auto rounded-md border border-border/60 bg-muted/20 px-2 py-1.5 text-2xs text-muted-foreground">
          {bookmarks.slice(0, 10).map((b) => (
            <li key={b.uuid} className="truncate">
              {b.title || getDomain(b.url)}
              <span className="ml-1 opacity-60">· {b.category}</span>
            </li>
          ))}
          {count > 10 && <li>… +{count - 10}</li>}
        </ul>

        <div className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs">
              <Tag className="h-3 w-3" />
              {t("category")}
            </Label>
            <Select
              value={categoryMode}
              onValueChange={(v) => setCategoryMode(v as CategoryMode)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">{t("categoryKeep")}</SelectItem>
                <SelectItem value="set">{t("categorySet")}</SelectItem>
              </SelectContent>
            </Select>
            {categoryMode === "set" &&
              (!isCreatingCategory ? (
                <div className="flex gap-2">
                  <Select
                    value={category}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        setIsCreatingCategory(true);
                        setNewCategory("");
                      } else {
                        setCategory(v);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 flex-1 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__">
                        + {t("newCategory")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setIsCreatingCategory(true)}
                    title={t("newCategory")}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder={t("newCategoryPlaceholder")}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => setIsCreatingCategory(false)}
                  >
                    {t("backToCategories")}
                  </Button>
                </div>
              ))}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs">
              <FileText className="h-3 w-3" />
              {t("descriptionField")}
            </Label>
            <Select
              value={descriptionMode}
              onValueChange={(v) => setDescriptionMode(v as DescriptionMode)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">{t("descKeep")}</SelectItem>
                <SelectItem value="set">{t("descSet")}</SelectItem>
                <SelectItem value="append">{t("descAppend")}</SelectItem>
                <SelectItem value="clear">{t("descClear")}</SelectItem>
              </SelectContent>
            </Select>
            {(descriptionMode === "set" || descriptionMode === "append") && (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  descriptionMode === "append"
                    ? t("descAppendPlaceholder")
                    : t("descSetPlaceholder")
                }
                className="min-h-[72px] text-sm"
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting || !writeToken || !hasChanges}
            onClick={() => void onSubmit()}
          >
            {isSubmitting && (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            )}
            {t("apply", { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
