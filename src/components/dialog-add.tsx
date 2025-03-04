"use client";

import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useServerAction } from "zsa-react";
import { useTranslations } from "next-intl";
import { Loader2, Link, FileText, Tag, Plus, PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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

import { createBookmarkAction } from "@/lib/actions";
import { insertSchema, type InsertSchema } from "@/lib/schema";
import type { BookmarkInstance } from "@/lib/types";

interface DialogCreateProps {
  mark: string;
  categories: string[];
  onBookmarkAdded: (bookmark: BookmarkInstance) => void;
}

export function DialogAdd({
  mark,
  categories,
  onBookmarkAdded,
}: DialogCreateProps) {
  const t = useTranslations("Components.BookmarkDialog");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  const form = useForm<InsertSchema>({
    // @ts-ignore
    resolver: zodResolver(insertSchema),
    defaultValues: {
      mark,
      url: "",
      title: "",
      description: "",
      category: categories[0] || "",
    },
  });

  const { execute: create } = useServerAction(createBookmarkAction, {
    onError: (error) => {
      setIsSubmitting(false);
      toast.dismiss();
      toast.error(error.err.message || t("errors.addFailed"));
    },
    onStart: () => {
      setIsSubmitting(true);
      toast.loading(t("adding"));
    },
    onSuccess: async (bookmark) => {
      setIsSubmitting(false);
      toast.dismiss();
      toast.success(t("addSuccess"));
      onBookmarkAdded(bookmark.data);
      form.reset();
      setOpen(false);
    },
  });

  const handleCategoryChange = (value: string) => {
    if (value === "new_category") {
      setIsCreatingNewCategory(true);
      form.setValue("category", "");
    } else {
      setIsCreatingNewCategory(false);
      form.setValue("category", value);
    }
  };

  const handleNewCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewCategory(value);
    form.setValue("category", value);
  };

  const onSubmit = async (data: InsertSchema) => {
    const formData = new FormData();
    formData.append("mark", data.mark);
    formData.append("url", data.url);
    formData.append("title", data.title);
    formData.append("description", data.description || "");

    // 使用新分类或选择的分类
    const categoryValue = isCreatingNewCategory ? newCategory : data.category;
    formData.append("category", categoryValue);

    create(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="hover-scale">
          <Button className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md">
            <PlusCircle className="h-4 w-4" />
            {t("addBookmark")}
          </Button>
        </div>
      </DialogTrigger>
      <DialogContent className="dialog-content sm:max-w-[425px] border border-blue-500/20 bg-card/95 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <span className="bg-blue-500/10 p-1.5 rounded-md">
              <Plus className="h-4 w-4 text-blue-500" />
            </span>
            {t("addTitle")}
          </DialogTitle>
          <DialogDescription>{t("addDescription", { mark })}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-4"
          >
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Link className="h-3.5 w-3.5 text-blue-500" />
                    {t("url")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("urlPlaceholder")}
                      className="border-blue-500/20 focus:border-blue-500/40 bg-blue-500/5 focus:ring-blue-500/10"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t("urlDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-indigo-500" />
                    {t("title")}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("titlePlaceholder")}
                      className="border-indigo-500/20 focus:border-indigo-500/40 bg-indigo-500/5 focus:ring-indigo-500/10"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t("titleDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-purple-500" />
                    {t("description")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      className="border-purple-500/20 focus:border-purple-500/40 bg-purple-500/5 focus:ring-purple-500/10"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("descriptionDescription")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-green-500" />
                    {t("category")}
                  </FormLabel>
                  {!isCreatingNewCategory ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Select
                          onValueChange={handleCategoryChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="border-green-500/20 focus:border-green-500/40 bg-green-500/5 focus:ring-green-500/10">
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
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setIsCreatingNewCategory(true)}
                          className="h-9 w-9 border-green-500/20 hover:bg-green-500/10"
                          title={t("newCategory")}
                        >
                          <Plus className="h-4 w-4 text-green-500" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          value={newCategory}
                          onChange={handleNewCategoryChange}
                          placeholder={t("newCategoryPlaceholder")}
                          className="border-green-500/20 focus:border-green-500/40 bg-green-500/5 focus:ring-green-500/10"
                          autoFocus
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsCreatingNewCategory(false)}
                        className="h-9 w-9 border-green-500/20 hover:bg-green-500/10"
                        title={t("backToCategories")}
                      >
                        <Tag className="h-4 w-4 text-green-500" />
                      </Button>
                    </div>
                  )}
                  <FormDescription>{t("categoryDescription")}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("cancel")}
                </Button>
              </DialogClose>
              <div className="hover-scale-sm">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                >
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("addButton")}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
