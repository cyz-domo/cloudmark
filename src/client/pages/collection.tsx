import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import {
  Folder,
  HelpCircle,
  KeyRound,
  Loader2,
  Plus,
  Search,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { BookmarkInstance, BookmarksData } from "@/shared/types";
import { isDemoMark } from "@/shared/types";
import { getBaseUrl, getCategories } from "@/shared/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/shared/utils";
import { fetchCollection } from "@/client/lib/api";
import { getStoredWriteToken } from "@/client/lib/token-store";
import {
  ALL_CATEGORIES,
  useBookmarkFilter,
  type SortKey,
} from "@/client/hooks/use-bookmark-filter";
import { useHotkeys, type HotkeyBinding } from "@/client/hooks/use-hotkeys";
import { useTranslations } from "@/client/i18n/context";
import { BookmarkRow } from "@/client/components/bookmark-row";
import { DialogAdd } from "@/client/components/dialog-add";
import { DialogEdit } from "@/client/components/dialog-edit";
import { DialogDelete } from "@/client/components/dialog-delete";
import { DemoBanner } from "@/client/components/demo-banner";
import { MigrationBanner } from "@/client/components/migration-banner";
import { BookmarkletButton } from "@/client/components/bookmarklet-button";
import {
  ShortcutHelp,
  type ShortcutItem,
} from "@/client/components/shortcut-help";
import { TokenManager } from "@/client/components/token-manager";
import { ImportExportDialog } from "@/client/components/import-export";

export function CollectionPage() {
  const params = useParams<{ mark: string }>();
  const location = useLocation();
  const mark =
    params.mark ||
    (location.pathname === "/demo" || location.pathname.startsWith("/demo/")
      ? "demo"
      : "");
  const [searchParams, setSearchParams] = useSearchParams();
  const t = useTranslations("BookmarksPage");
  const ts = useTranslations("Shortcuts");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BookmarksData | null>(null);
  const [issuedWriteToken, setIssuedWriteToken] = useState<string | undefined>();
  const [migratedFromKv, setMigratedFromKv] = useState(false);
  const [writeToken, setWriteToken] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const baseUrl = getBaseUrl();
  const bookmarks = data?.bookmarks ?? [];
  const filter = useBookmarkFilter(bookmarks);
  const { filtered, query, setQuery, category, setCategory, sort, setSort } =
    filter;

  const categories = useMemo(
    () => (data ? getCategories(data) : ["default"]),
    [data],
  );

  const dialogOpen =
    addOpen ||
    editOpen ||
    deleteOpen ||
    helpOpen ||
    tokenOpen ||
    importExportOpen;
  const selected = filtered[selectedIndex] ?? null;
  const canWrite = Boolean(writeToken) && !isDemoMark(mark);

  // Load collection
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCollection(mark)
      .then((page) => {
        if (cancelled) return;
        setData(
          page.bookmarksData ?? {
            mark,
            bookmarks: [],
          },
        );
        setIssuedWriteToken(page.issuedWriteToken);
        setMigratedFromKv(Boolean(page.migratedFromKv));
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load");
          setData({ mark, bookmarks: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mark]);

  useEffect(() => {
    if (isDemoMark(mark)) {
      setWriteToken(null);
      return;
    }
    setWriteToken(getStoredWriteToken(mark));
  }, [mark]);

  // URL toast from bookmarklet redirect
  useEffect(() => {
    const status = searchParams.get("status");
    const message = searchParams.get("message");
    if (!status || !message) return;

    const known: Record<string, string> = {
      bookmarkAdded: t("notifications.bookmarkAdded"),
      bookmarkExists: t("notifications.bookmarkExists"),
      markRequired: t("notifications.markRequired"),
      urlRequired: t("notifications.urlRequired"),
      tokenRequired: t("notifications.tokenRequired"),
      processingError: t("notifications.processingError"),
    };
    // searchParams already decodes %XX; also normalize legacy + as space
    const raw = message.replace(/\+/g, " ");
    const description = known[raw] ?? raw;
    const variant =
      status === "success"
        ? "success"
        : status === "error"
          ? "error"
          : status === "warning"
            ? "warning"
            : "info";

    if (variant === "success") toast.success(description);
    else if (variant === "error") toast.error(description);
    else if (variant === "warning") toast.warning(description);
    else toast(description);

    // Refresh list after a successful bookmarklet save
    if (status === "success") {
      void fetchCollection(mark)
        .then((page) => {
          if (page.bookmarksData) setData(page.bookmarksData);
        })
        .catch(() => {
          /* ignore refresh errors */
        });
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, t, mark]);

  // Clamp selection when filter changes
  useEffect(() => {
    setSelectedIndex((i) => {
      if (filtered.length === 0) return 0;
      return Math.min(i, filtered.length - 1);
    });
  }, [filtered.length]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-uuid="${selected?.uuid}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [selected?.uuid]);

  const openSelected = useCallback(() => {
    if (selected) window.open(selected.url, "_blank", "noopener,noreferrer");
  }, [selected]);

  const moveSelection = useCallback(
    (delta: number) => {
      if (filtered.length === 0) return;
      setSelectedIndex((i) => {
        const next = i + delta;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
    },
    [filtered.length],
  );

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategory(ALL_CATEGORIES);
    searchRef.current?.blur();
  }, [setQuery, setCategory]);

  const onTokenReady = useCallback((token: string | null) => {
    setWriteToken(token);
  }, []);

  const onImported = useCallback((newOnes: BookmarkInstance[]) => {
    if (newOnes.length === 0) return;
    setData((prev) => {
      if (!prev) return { mark, bookmarks: newOnes };
      const urls = new Set(prev.bookmarks.map((b) => b.url));
      const merged = [
        ...prev.bookmarks,
        ...newOnes.filter((b) => !urls.has(b.url)),
      ];
      return { ...prev, bookmarks: merged };
    });
  }, [mark]);

  const onBookmarkAdded = useCallback((bookmark: BookmarkInstance) => {
    setData((prev) => {
      if (!prev) return { mark, bookmarks: [bookmark] };
      return { ...prev, bookmarks: [...prev.bookmarks, bookmark] };
    });
  }, [mark]);

  const onBookmarkUpdated = useCallback((bookmark: BookmarkInstance) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        bookmarks: prev.bookmarks.map((b) =>
          b.uuid === bookmark.uuid ? bookmark : b,
        ),
      };
    });
  }, []);

  const onBookmarkDeleted = useCallback((uuid: string) => {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        bookmarks: prev.bookmarks.filter((b) => b.uuid !== uuid),
      };
    });
  }, []);

  const shortcutItems: ShortcutItem[] = useMemo(
    () => [
      { keys: ["/", "⌘K"], label: ts("focusSearch") },
      { keys: ["j", "↓"], label: ts("next") },
      { keys: ["k", "↑"], label: ts("prev") },
      { keys: ["Enter", "o"], label: ts("open") },
      { keys: ["n"], label: ts("add") },
      { keys: ["e"], label: ts("edit") },
      { keys: ["d"], label: ts("delete") },
      { keys: ["0–9"], label: ts("filterCategory") },
      { keys: ["Esc"], label: ts("clear") },
      { keys: ["?"], label: ts("help") },
    ],
    [ts],
  );

  const hotkeys: HotkeyBinding[] = useMemo(() => {
    if (dialogOpen) {
      return [
        {
          key: "Escape",
          allowInInput: true,
          handler: () => {
            setAddOpen(false);
            setEditOpen(false);
            setDeleteOpen(false);
            setHelpOpen(false);
            setTokenOpen(false);
            setImportExportOpen(false);
          },
        },
      ];
    }

    const bindings: HotkeyBinding[] = [
      {
        key: "/",
        handler: () => searchRef.current?.focus(),
      },
      {
        key: "k",
        meta: true,
        allowInInput: true,
        handler: () => searchRef.current?.focus(),
      },
      {
        key: "j",
        handler: () => moveSelection(1),
      },
      {
        key: "ArrowDown",
        handler: () => moveSelection(1),
      },
      {
        key: "k",
        handler: () => moveSelection(-1),
      },
      {
        key: "ArrowUp",
        handler: () => moveSelection(-1),
      },
      {
        key: "Enter",
        handler: () => openSelected(),
      },
      {
        key: "o",
        handler: () => openSelected(),
      },
      {
        key: "n",
        handler: () => {
          if (canWrite) setAddOpen(true);
          else toast.error(t("notifications.tokenRequired"));
        },
      },
      {
        key: "e",
        handler: () => {
          if (!selected) return;
          if (!canWrite) {
            toast.error(t("notifications.tokenRequired"));
            return;
          }
          setEditOpen(true);
        },
      },
      {
        key: "d",
        handler: () => {
          if (!selected) return;
          if (!canWrite) {
            toast.error(t("notifications.tokenRequired"));
            return;
          }
          setDeleteOpen(true);
        },
      },
      {
        key: "Escape",
        allowInInput: true,
        handler: () => {
          if (document.activeElement === searchRef.current && query) {
            setQuery("");
            return;
          }
          if (document.activeElement === searchRef.current) {
            searchRef.current?.blur();
            return;
          }
          clearFilters();
        },
      },
      {
        key: "?",
        shift: true,
        handler: () => setHelpOpen(true),
      },
      {
        key: "/",
        shift: true,
        handler: () => setHelpOpen(true),
      },
    ];

    // 0 = all, 1–9 = categories
    for (let n = 0; n <= 9; n++) {
      bindings.push({
        key: String(n),
        handler: () => {
          if (n === 0) {
            setCategory(ALL_CATEGORIES);
            return;
          }
          const cat = filter.categories[n - 1];
          if (cat) setCategory(cat);
        },
      });
    }

    return bindings;
  }, [
    dialogOpen,
    moveSelection,
    openSelected,
    canWrite,
    selected,
    t,
    query,
    setQuery,
    clearFilters,
    setCategory,
    filter.categories,
  ]);

  useHotkeys(hotkeys);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 py-3 sm:px-4">
      <DemoBanner mark={mark} />
      {!isDemoMark(mark) && (
        <MigrationBanner
          mark={mark}
          baseUrl={baseUrl}
          issuedWriteToken={issuedWriteToken}
          migratedFromKv={migratedFromKv}
          onTokenReady={onTokenReady}
          onOpenTokenManager={() => setTokenOpen(true)}
        />
      )}

      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {t("title")}
            <span className="ml-2 font-normal text-muted-foreground">
              /{mark}
            </span>
          </h1>
          <p className="text-2xs text-muted-foreground">
            {filtered.length === filter.total
              ? ts("countAll", { count: filter.total })
              : ts("countFiltered", {
                  shown: filtered.length,
                  total: filter.total,
                })}
            <span className="ml-2 hidden sm:inline">
              · <kbd>?</kbd> {ts("helpHint")}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!isDemoMark(mark) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => setTokenOpen(true)}
              title={t("tokenManager")}
            >
              <KeyRound className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("tokenManager")}</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setImportExportOpen(true)}
            title={t("importExport")}
          >
            <Upload className="mr-1 h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("importExport")}</span>
          </Button>
          <BookmarkletButton
            mark={mark}
            baseUrl={baseUrl}
            writeToken={writeToken}
            compact
          />
          <Button
            size="sm"
            className="h-8"
            disabled={!canWrite}
            onClick={() => setAddOpen(true)}
            title={!canWrite ? t("notifications.tokenRequired") : "n"}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("addBookmark")}
            <kbd className="ml-1.5 hidden border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground sm:inline-flex">
              n
            </kbd>
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* Category sidebar */}
        <aside className="hidden w-44 shrink-0 flex-col md:flex">
          <div className="mb-1.5 flex items-center gap-1.5 px-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            <Folder className="h-3 w-3" />
            {ts("categories")}
          </div>
          <nav className="space-y-0.5">
            <CategoryButton
              active={category === ALL_CATEGORIES}
              label={ts("all")}
              count={filter.total}
              shortcut="0"
              onClick={() => setCategory(ALL_CATEGORIES)}
            />
            {filter.categories.map((cat, i) => (
              <CategoryButton
                key={cat}
                active={category === cat}
                label={cat}
                count={filter.categoryCounts.get(cat) ?? 0}
                shortcut={i < 9 ? String(i + 1) : undefined}
                onClick={() => setCategory(cat)}
              />
            ))}
          </nav>
        </aside>

        {/* Main list */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-border/80 bg-card/40">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/80 bg-muted/30 px-2 py-1.5">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ts("searchPlaceholder")}
                className="h-8 border-border/60 bg-background pl-7 pr-16 text-sm"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground">
                <kbd>/</kbd>
              </span>
            </div>

            <Select
              value={category}
              onValueChange={setCategory}
            >
              <SelectTrigger className="h-8 w-[8.5rem] text-xs md:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>{ts("all")}</SelectItem>
                {filter.categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-[7.5rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{ts("sortNewest")}</SelectItem>
                <SelectItem value="oldest">{ts("sortOldest")}</SelectItem>
                <SelectItem value="title">{ts("sortTitle")}</SelectItem>
                <SelectItem value="category">{ts("sortCategory")}</SelectItem>
              </SelectContent>
            </Select>

            {(query || category !== ALL_CATEGORIES) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={clearFilters}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                {ts("clear")}
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setHelpOpen(true)}
              title="?"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>

          {/* Column headers (desktop) */}
          <div className="hidden grid-cols-[auto_minmax(0,1fr)_minmax(0,8rem)_auto_auto] gap-3 border-b border-border/60 bg-muted/20 px-3 py-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span className="w-5" />
            <span>{ts("colTitle")}</span>
            <span>{ts("colCategory")}</span>
            <span>{ts("colDate")}</span>
            <span className="w-[5.25rem]" />
          </div>

          <div
            ref={listRef}
            role="listbox"
            aria-label={t("title")}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
                <Search className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {bookmarks.length === 0 ? t("noBookmarks") : ts("noResults")}
                </p>
                {bookmarks.length === 0 && canWrite && (
                  <Button size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t("addFirstBookmark")}
                  </Button>
                )}
                {bookmarks.length === 0 && !canWrite && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/doc">{t("createOwn")}</Link>
                  </Button>
                )}
              </div>
            ) : (
              filtered.map((bookmark, index) => (
                <BookmarkRow
                  key={bookmark.uuid}
                  bookmark={bookmark}
                  selected={index === selectedIndex}
                  canWrite={canWrite}
                  onSelect={() => setSelectedIndex(index)}
                  onOpen={() =>
                    window.open(bookmark.url, "_blank", "noopener,noreferrer")
                  }
                  onEdit={() => {
                    setSelectedIndex(index);
                    setEditOpen(true);
                  }}
                  onDelete={() => {
                    setSelectedIndex(index);
                    setDeleteOpen(true);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <DialogAdd
        mark={mark}
        categories={categories}
        writeToken={writeToken}
        open={addOpen}
        onOpenChange={setAddOpen}
        onBookmarkAdded={onBookmarkAdded}
      />
      <DialogEdit
        mark={mark}
        bookmark={selected}
        categories={categories}
        writeToken={writeToken}
        open={editOpen}
        onOpenChange={setEditOpen}
        onBookmarkUpdated={onBookmarkUpdated}
      />
      <DialogDelete
        mark={mark}
        bookmark={selected}
        writeToken={writeToken}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onBookmarkDeleted={onBookmarkDeleted}
      />
      <ShortcutHelp
        open={helpOpen}
        onOpenChange={setHelpOpen}
        shortcuts={shortcutItems}
      />
      {!isDemoMark(mark) && (
        <TokenManager
          mark={mark}
          baseUrl={baseUrl}
          open={tokenOpen}
          onOpenChange={setTokenOpen}
          writeToken={writeToken}
          issuedWriteToken={issuedWriteToken}
          onTokenReady={onTokenReady}
        />
      )}
      <ImportExportDialog
        mark={mark}
        writeToken={writeToken}
        bookmarks={bookmarks}
        open={importExportOpen}
        onOpenChange={setImportExportOpen}
        onImported={onImported}
      />
    </div>
  );
}

function CategoryButton({
  active,
  label,
  count,
  shortcut,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="tabular-nums text-2xs opacity-70">{count}</span>
      {shortcut ? (
        <kbd className="ml-0.5 opacity-60">{shortcut}</kbd>
      ) : null}
    </button>
  );
}
