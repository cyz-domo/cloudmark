import { useEffect, useState } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Link, FileText, Tag, Pencil } from "lucide-react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateSchema, type UpdateSchema } from "@/shared/schema";
import type { BookmarkInstance } from "@/shared/types";
import { updateBookmarkApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";

interface DialogEditProps {
  mark: string;
  bookmark: BookmarkInstance | null;
  categories: string[];
  writeToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookmarkUpdated: (bookmark: BookmarkInstance) => void;
}

export function DialogEdit({
  mark,
  bookmark,
  categories,
  writeToken,
  open,
  onOpenChange,
  onBookmarkUpdated,
}: DialogEditProps) {
  const t = useTranslations("Components.BookmarkDialog");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const form = useForm<UpdateSchema>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      mark,
      token: writeToken || "",
      uuid: bookmark?.uuid || "",
      url: bookmark?.url || "",
      title: bookmark?.title || "",
      description: bookmark?.description || "",
      category: bookmark?.category || "default",
    },
  });

  useEffect(() => {
    if (open && bookmark) {
      form.reset({
        mark,
        token: writeToken || "",
        uuid: bookmark.uuid,
        url: bookmark.url,
        title: bookmark.title,
        description: bookmark.description || "",
        category: bookmark.category,
      });
      setIsCreatingNewCategory(false);
      setNewCategory("");
    }
  }, [open, bookmark, mark, writeToken, form]);

  const onSubmit = async (data: UpdateSchema) => {
    if (!writeToken) {
      toast.error(t("errors.tokenRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await updateBookmarkApi({
        mark: data.mark,
        token: writeToken,
        uuid: data.uuid,
        url: data.url,
        title: data.title,
        description: data.description,
        category: isCreatingNewCategory ? newCategory : data.category,
      });
      toast.success(t("updateSuccess"));
      onBookmarkUpdated(updated);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.updateFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!bookmark) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Pencil className="h-4 w-4" />
            {t("editTitle")}
          </DialogTitle>
          <DialogDescription>{t("editDescription")}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-3 pt-2"
          >
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-xs">
                    <Link className="h-3 w-3" />
                    {t("url")}
                  </FormLabel>
                  <FormControl>
                    <Input className="h-8" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-xs">
                    <FileText className="h-3 w-3" />
                    {t("title")}
                  </FormLabel>
                  <FormControl>
                    <Input className="h-8" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-xs">
                    <FileText className="h-3 w-3" />
                    {t("description")}
                  </FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[60px] text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-xs">
                    <Tag className="h-3 w-3" />
                    {t("category")}
                  </FormLabel>
                  {!isCreatingNewCategory ? (
                    <Select
                      onValueChange={(v) => {
                        if (v === "__new__") {
                          setIsCreatingNewCategory(true);
                          form.setValue("category", "");
                        } else {
                          field.onChange(v);
                        }
                      }}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          + {t("newCategory")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        value={newCategory}
                        onChange={(e) => {
                          setNewCategory(e.target.value);
                          form.setValue("category", e.target.value);
                        }}
                        placeholder={t("newCategoryPlaceholder")}
                        className="h-8"
                        autoFocus
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setIsCreatingNewCategory(false)}
                      >
                        {t("backToCategories")}
                      </Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button type="button" variant="outline" size="sm">
                  {t("cancel")}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !writeToken}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                )}
                {t("updateButton")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
