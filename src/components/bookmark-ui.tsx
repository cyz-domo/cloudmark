"use client";

import { useState, useEffect, useCallback } from "react";
import {
  defaultCategory,
  type BookmarkInstance,
  type BookmarksData,
} from "@/lib/types";
import { BookmarkCard } from "@/components/bookmark-card";
import { Search, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { DemoBanner } from "./demo-banner";
import { DialogAdd } from "./dialog-add";
import { BookmarkletButton } from "./bookmarklet-button";
import { useToast } from "./toast-provider";
import { useRouter } from "next/navigation";
import { FloatingNav } from "./floating-nav";
import { MigrationBanner } from "./migration-banner";
import { isDemoMark } from "@/lib/types";
import { getStoredWriteToken } from "@/lib/token-store";

export interface BookmarkUIProps {
  mark: string;
  bookmarksData: BookmarksData | null;
  categories: string[];
  toast: { status: string; message: string } | null;
  baseUrl: string;
  issuedWriteToken?: string;
  migratedFromKv?: boolean;
  collectionExists?: boolean;
}

export function BookmarkUI({
  mark,
  bookmarksData,
  categories,
  toast,
  baseUrl,
  issuedWriteToken,
  migratedFromKv,
}: BookmarkUIProps) {
  const t = useTranslations("BookmarksPage");
  const { showToast } = useToast();
  const router = useRouter();
  const [currentBookmarksData, setCurrentBookmarksData] =
    useState<BookmarksData | null>(bookmarksData);
  const [writeToken, setWriteToken] = useState<string | null>(null);

  useEffect(() => {
    setCurrentBookmarksData(bookmarksData);
  }, [bookmarksData]);

  useEffect(() => {
    if (isDemoMark(mark)) {
      setWriteToken(null);
      return;
    }
    const stored = getStoredWriteToken(mark);
    if (stored) {
      setWriteToken(stored);
    }
  }, [mark]);

  useEffect(() => {
    if (toast) {
      const variant =
        toast.status === "success"
          ? "success"
          : toast.status === "error"
            ? "error"
            : toast.status === "warning"
              ? "warning"
              : "info";
      const raw = decodeURIComponent(toast.message);
      const knownKeys: Record<string, string> = {
        bookmarkAdded: t("notifications.bookmarkAdded"),
        markRequired: t("notifications.markRequired"),
        urlRequired: t("notifications.urlRequired"),
        tokenRequired: t("notifications.tokenRequired"),
        processingError: t("notifications.processingError"),
      };
      const description = knownKeys[raw] ?? raw;
      showToast({
        title: t(toast.status as "success"),
        description,
        variant,
      });
    }
  }, [toast, showToast, t]);

  const onTokenReady = useCallback((token: string) => {
    setWriteToken(token);
  }, []);

  const refreshBookmarks = useCallback(() => {
    router.refresh();
  }, [router]);

  const onBookmarkAdded = useCallback(
    (bookmark: BookmarkInstance) => {
      setCurrentBookmarksData((prev) => {
        if (!prev) {
          return { mark, bookmarks: [bookmark] };
        }
        return {
          ...prev,
          bookmarks: [...prev.bookmarks, bookmark],
        };
      });
      refreshBookmarks();
    },
    [mark, refreshBookmarks],
  );

  const onUpdateBookmark = useCallback(
    (bookmark: BookmarkInstance) => {
      setCurrentBookmarksData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookmarks: prev.bookmarks.map((b) =>
            b.uuid === bookmark.uuid ? bookmark : b,
          ),
        };
      });
      refreshBookmarks();
    },
    [refreshBookmarks],
  );

  const onDeleteBookmark = useCallback(
    (uuid: string) => {
      setCurrentBookmarksData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          bookmarks: prev.bookmarks.filter((b) => b.uuid !== uuid),
        };
      });
      refreshBookmarks();
    },
    [refreshBookmarks],
  );

  const data = currentBookmarksData;
  const cats = data
    ? [
        defaultCategory,
        ...new Set(
          data.bookmarks
            .map((b) => b.category)
            .filter((c) => c && c !== defaultCategory),
        ),
      ]
    : categories;

  const validCategories = cats.filter((cat) => cat.trim() !== "");

  return (
    <div className="container relative">
      <FloatingNav categories={validCategories} bookmarksData={data} />

      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-blue-500/10 rounded-full blur-3xl transform -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-[50rem] h-[50rem] bg-purple-500/10 rounded-full blur-3xl transform translate-y-12 -translate-x-12" />
        <div className="absolute bottom-1/3 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="py-12 lg:py-16 scroll-smooth">
        <DemoBanner mark={mark} />

        {!isDemoMark(mark) && (
          <MigrationBanner
            mark={mark}
            baseUrl={baseUrl}
            issuedWriteToken={issuedWriteToken}
            migratedFromKv={migratedFromKv}
            onTokenReady={onTokenReady}
          />
        )}

        <div className="title-area flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <div className="title-text flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500">
                {t("title")}
              </h1>
            </div>
            <p className="subtitle-text text-muted-foreground">
              {t("collection", { mark })}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <DialogAdd
              mark={mark}
              categories={validCategories}
              writeToken={writeToken}
              onBookmarkAdded={onBookmarkAdded}
            />

            <div>
              <BookmarkletButton
                mark={mark}
                baseUrl={baseUrl}
                writeToken={writeToken}
              />
              <div className="hidden sm:flex items-center mt-1 text-xs text-muted-foreground">
                <span className="animate-pulse">↑</span>
                <span className="ml-1">{t("dragTip")}</span>
              </div>
            </div>
          </div>
        </div>

        {data && data.bookmarks.length > 0 && validCategories.length > 0 ? (
          <div className="stagger-container space-y-8">
            {validCategories.map((category, categoryIndex) => {
              const categoryBookmarks = data.bookmarks.filter(
                (b) => b.category === category,
              );

              if (categoryBookmarks.length === 0) return null;

              return (
                <div
                  key={category}
                  id={`category-${category}`}
                  className={`stagger-item delay-${
                    categoryIndex * 100
                  } overflow-hidden scroll-mt-24`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex items-center px-3 py-1.5 bg-primary/10 text-primary rounded-lg">
                      <Layers className="h-4 w-4 mr-2 opacity-70" />
                      <h3 className="text-md font-medium">{category}</h3>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ({categoryBookmarks.length})
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryBookmarks.map((bookmark, index) => (
                      <div
                        key={bookmark.uuid}
                        className={`h-full w-full delay-${(index % 9) * 100}`}
                      >
                        <BookmarkCard
                          bookmark={bookmark}
                          mark={mark}
                          categories={validCategories}
                          writeToken={writeToken}
                          onBookmarkUpdated={onUpdateBookmark}
                          onBookmarkDeleted={() =>
                            onDeleteBookmark(bookmark.uuid)
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state text-center py-16 px-4">
            <div className="max-w-md mx-auto">
              <div className="bg-card/50 backdrop-blur-sm border border-border/60 rounded-xl p-8 shadow-sm">
                <div className="flex justify-center mb-4">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-md"></div>
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-muted-foreground text-lg mb-6">
                  {t("noBookmarks")}
                </p>
                <div className="hover-scale flex justify-center">
                  <DialogAdd
                    mark={mark}
                    categories={validCategories}
                    writeToken={writeToken}
                    onBookmarkAdded={onBookmarkAdded}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
