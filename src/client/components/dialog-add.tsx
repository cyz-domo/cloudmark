import { useEffect, useState } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2, Link, FileText, Tag, Plus } from "lucide-react";
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
import { insertSchema, type InsertSchema } from "@/shared/schema";
import type { BookmarkInstance } from "@/shared/types";
import { createBookmarkApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";
import { IconPicker } from "@/client/components/icon-picker";

interface DialogAddProps {
  mark: string;
  categories: string[];
  writeToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBookmarkAdded: (bookmark: BookmarkInstance) => void;
}

export function DialogAdd({
  mark,
  categories,
  writeToken,
  open,
  onOpenChange,
  onBookmarkAdded,
}: DialogAddProps) {
  const t = useTranslations("Components.BookmarkDialog");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [favicon, setFavicon] = useState<string | undefined>(undefined);

  const form = useForm<InsertSchema>({
    resolver: zodResolver(insertSchema),
    defaultValues: {
      mark,
      token: writeToken || "",
      url: "",
      title: "",
      description: "",
      category: categories[0] || "default",
      favicon: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        mark,
        token: writeToken || "",
        url: "",
        title: "",
        description: "",
        category: categories[0] || "default",
        favicon: undefined,
      });
      setFavicon(undefined);
      setIsCreatingNewCategory(false);
      setNewCategory("");
    }
  }, [open, mark, writeToken, categories, form]);

  const onSubmit = async (data: InsertSchema) => {
    if (!writeToken) {
      toast.error(t("errors.tokenRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      const bookmark = await createBookmarkApi({
        mark: data.mark,
        token: writeToken,
        url: data.url,
        title: data.title,
        description: data.description,
        category: isCreatingNewCategory ? newCategory : data.category,
        favicon: favicon || undefined,
      });
      toast.success(t("addSuccess"));
      onBookmarkAdded(bookmark);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errors.addFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-4 w-4" />
            {t("addTitle")}
          </DialogTitle>
          <DialogDescription>{t("addDescription", { mark })}</DialogDescription>
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
                    <Input
                      placeholder={t("urlPlaceholder")}
                      className="h-8"
                      autoFocus
                      {...field}
                    />
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
                    <Input
                      placeholder={t("titlePlaceholder")}
                      className="h-8"
                      {...field}
                    />
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
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      className="min-h-[60px] text-sm"
                      {...field}
                    />
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
                    <div className="flex gap-2">
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
                            <SelectValue
                              placeholder={t("categoryPlaceholder")}
                            />
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
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <FormControl>
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
                      </FormControl>
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

            <IconPicker
              value={favicon}
              onChange={setFavicon}
              pageUrl={form.watch("url")}
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
                {t("addButton")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
