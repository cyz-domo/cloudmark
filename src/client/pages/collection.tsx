import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Folder,
  HelpCircle,
  KeyRound,
  Loader2,
  RefreshCw,
  Plus,
  Search,
  Pencil,
  Settings2,
  Trash2,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BookmarkInstance,
  BookmarksData,
  CollectionSettings,
  SortProfile,
} from "@/shared/types";
import {
  DEFAULT_COLLECTION_SETTINGS,
  isDemoMark,
} from "@/shared/types";
import { getBaseUrl } from "@/shared/utils";
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
import { claimCollectionApi, fetchCollection, reorderBookmarksApi, reorderCategoriesApi, renameCategoryApi, deleteCategoryApi, saveSortProfileOrdersApi, createSortProfileApi, renameSortProfileApi, deleteSortProfileApi } from "@/client/lib/api";
import {
  clearStoredWriteToken,
  ensureLocalWriteToken,
  getStoredWriteToken,
  isTokenBackupAcknowledged,
  setStoredWriteToken,
} from "@/client/lib/token-store";
import {
  ALL_CATEGORIES,
  isCategoryInTree,
  useBookmarkFilter,
  type SortColumn,
  type SortKey,
} from "@/client/hooks/use-bookmark-filter";
import { useHotkeys, type HotkeyBinding } from "@/client/hooks/use-hotkeys";
import { useTranslations } from "@/client/i18n/context";
import {
  BookmarkRow,
  BOOKMARK_ROW_GRID,
} from "@/client/components/bookmark-row";
import { DialogAdd } from "@/client/components/dialog-add";
import { DialogEdit } from "@/client/components/dialog-edit";
import { DialogDelete } from "@/client/components/dialog-delete";
import { DialogBulkEdit } from "@/client/components/dialog-bulk-edit";
import { DemoBanner } from "@/client/components/demo-banner";
import { MigrationBanner } from "@/client/components/migration-banner";
import { BookmarkletButton } from "@/client/components/bookmarklet-button";
import {
  ShortcutHelp,
  type ShortcutItem,
} from "@/client/components/shortcut-help";
import { TokenManager } from "@/client/components/token-manager";
import { TokenUnlockForm } from "@/client/components/token-unlock-form";
import { ImportExportDialog } from "@/client/components/import-export";
import { CollectionSettingsDialog } from "@/client/components/collection-settings-dialog";

function renameCategoryPath(path: string, from: string, to: string): string {
  return path === from || path.startsWith(`${from} / `)
    ? `${to}${path.slice(from.length)}`
    : path;
}

const FIXED_SORT_KEYS: SortKey[] = ["newest", "oldest", "title", "title-desc", "category", "category-desc", "url", "url-desc"];
function isFixedSortKey(value: string): value is SortKey { return FIXED_SORT_KEYS.includes(value as SortKey); }

function applySortProfile(bookmarks: BookmarkInstance[], profile?: SortProfile): BookmarkInstance[] {
  if (!profile) return bookmarks;
  const order = new Map(profile.orders.flatMap(({ uuids }, categoryIndex) => uuids.map((uuid, itemIndex) => [uuid, categoryIndex * 10000 + itemIndex] as const)));
  return [...bookmarks].sort((a, b) => (order.get(a.uuid) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.uuid) ?? Number.MAX_SAFE_INTEGER));
}

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
  const tset = useTranslations("CollectionSettings");

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BookmarksData | null>(null);
  const [collectionExists, setCollectionExists] = useState(false);
  const [issuedWriteToken, setIssuedWriteToken] = useState<string | undefined>();
  const [migratedFromKv, setMigratedFromKv] = useState(false);
  const [writeToken, setWriteToken] = useState<string | null>(null);
  /** Keyboard focus cursor index in filtered list */
  const [focusedIndex, setFocusedIndex] = useState(0);
  /** Multi-select set of uuids */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  /** Anchor for shift+click / shift+nav range select */
  const [anchorIndex, setAnchorIndex] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<CollectionSettings>({
    ...DEFAULT_COLLECTION_SETTINGS,
  });
  const [sortProfiles, setSortProfiles] = useState<SortProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSortProfileId, setActiveSortProfileId] = useState<string | null>(null);
  const [privateLocked, setPrivateLocked] = useState(false);
  const [draggedUuid, setDraggedUuid] = useState<string | null>(null);
  const [dragOverUuid, setDragOverUuid] = useState<string | null>(null);
  const [pendingOrders, setPendingOrders] = useState<Record<string, string[]>>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);
  const [categoryOrderDirty, setCategoryOrderDirty] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const baseUrl = getBaseUrl();
  const bookmarks = data?.bookmarks ?? [];
  const filter = useBookmarkFilter(bookmarks, categoryOrder);
  const {
    filtered,
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    sortColumn,
    sortDir,
    toggleSortColumn,
  } = filter;
  const manualSort = sort === "manual";

  useEffect(() => {
    if (!categoryOrderDirty || typeof window === "undefined") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [categoryOrderDirty]);

  const selectHomeSort = (value: string) => {
    const profile = sortProfiles.find((item) => item.id === value);
    setActiveSortProfileId(profile?.id ?? null);
    setSort(profile ? "manual" : isFixedSortKey(value) ? value : "newest");
    setData((previous) => previous && profile ? { ...previous, bookmarks: applySortProfile(previous.bookmarks, profile) } : previous);
  };

  const manageSortProfile = async (action: "create" | "rename" | "delete") => {
    if (!writeToken) return;
    const current = sortProfiles.find((profile) => profile.id === activeSortProfileId);
    const input = window.prompt(action === "create" ? "新建排序方案名称" : action === "rename" ? "重命名排序方案" : `输入“${current?.name ?? ""}”确认删除`, action === "rename" ? current?.name ?? "" : "")?.trim();
    if (!input || (action === "delete" && input !== current?.name) || (action !== "create" && !current)) return;
    try {
      if (action === "create") {
        const profile = await createSortProfileApi({ mark, token: writeToken, id: crypto.randomUUID(), name: input });
        setSortProfiles((previous) => [...previous, profile]);
        selectHomeSort(profile.id);
      } else if (action === "rename" && current) {
        await renameSortProfileApi({ mark, token: writeToken, id: current.id, name: input });
        setSortProfiles((previous) => previous.map((profile) => profile.id === current.id ? { ...profile, name: input } : profile));
      } else if (current) {
        await deleteSortProfileApi({ mark, token: writeToken, id: current.id });
        setSortProfiles((previous) => previous.filter((profile) => profile.id !== current.id));
        setActiveSortProfileId(null);
        setSort("newest");
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : "排序方案操作失败"); }
  };

  useEffect(() => {
    const canvas = document.querySelector<HTMLElement>(".app-canvas");
    const clearBackground = () => {
      if (!canvas) return;
      canvas.classList.remove("has-collection-background");
      canvas.style.removeProperty("--collection-background-image");
      canvas.style.backgroundImage = "";
      canvas.style.backgroundSize = "";
      canvas.style.backgroundAttachment = "";
      canvas.style.backgroundPosition = "";
    };

    if (settings.backgroundUrl) {
      if (canvas) {
        const safeUrl = settings.backgroundUrl.replaceAll('"', "%22");
        canvas.classList.add("has-collection-background");
        canvas.style.setProperty("--collection-background-image", `url("${safeUrl}")`);
      }
    } else {
      clearBackground();
    }
    return () => {
      clearBackground();
    };
  }, [settings.backgroundUrl]);

  const reorder = (targetUuid: string) => {
    if (!draggedUuid || draggedUuid === targetUuid || !canWrite || !manualSort) return;
    const current = bookmarks.filter((bookmark) =>
      category === ALL_CATEGORIES || bookmark.category === category,
    );
    const dragged = current.find((bookmark) => bookmark.uuid === draggedUuid);
    const target = current.find((bookmark) => bookmark.uuid === targetUuid);
    if (!dragged || !target || dragged.category !== target.category) return;
    const categoryItems = current.filter((bookmark) => bookmark.category === dragged.category);
    const next = [...categoryItems];
    const from = next.findIndex((bookmark) => bookmark.uuid === draggedUuid);
    const to = next.findIndex((bookmark) => bookmark.uuid === targetUuid);
    next.splice(from, 1);
    next.splice(to, 0, dragged);
    const positions = new Map(next.map((bookmark, index) => [bookmark.uuid, index]));
    setData((prev) => {
      if (!prev) return prev;
      const reordered = [...prev.bookmarks].sort((a, b) => {
        const aPosition = positions.get(a.uuid);
        const bPosition = positions.get(b.uuid);
        if (aPosition === undefined || bPosition === undefined) return 0;
        return aPosition - bPosition;
      });
      return { ...prev, bookmarks: reordered };
    });
    setPendingOrders((previous) => ({ ...previous, [dragged.category]: next.map((bookmark) => bookmark.uuid) }));
    setDraggedUuid(null);
    setDragOverUuid(null);
  };

  const savePendingOrders = async () => {
    if (!writeToken || !canWrite || (Object.keys(pendingOrders).length === 0 && !categoryOrderDirty)) return;
    setSavingOrder(true);
    try {
      if (Object.keys(pendingOrders).length > 0) {
        const orders = Object.entries(pendingOrders).map(([pendingCategory, uuids]) => ({
            category: pendingCategory,
            uuids,
          }));
        if (activeSortProfileId) {
          const pending = new Map(orders.map((order) => [order.category, order.uuids]));
          const profile = sortProfiles.find((item) => item.id === activeSortProfileId);
          const existing = new Map(profile?.orders.map((order) => [order.category, order.uuids]));
          const allOrders = [...new Set(bookmarks.map((bookmark) => bookmark.category))].map((category) => ({
            category,
            uuids: pending.get(category) ?? existing.get(category) ?? bookmarks.filter((bookmark) => bookmark.category === category).map((bookmark) => bookmark.uuid),
          }));
          await saveSortProfileOrdersApi({ mark, token: writeToken, id: activeSortProfileId, orders: allOrders });
        } else {
          await reorderBookmarksApi({ mark, token: writeToken, orders });
        }
      }
      if (categoryOrderDirty) await reorderCategoriesApi({ mark, token: writeToken, categories: filter.categories });
      setPendingOrders({});
      setCategoryOrder(filter.categories);
      setCategoryOrderDirty(false);
      toast.success(ts("reorderSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : ts("reorderFailed"));
    } finally {
      setSavingOrder(false);
    }
  };

  const categories = filter.categories.length ? filter.categories : ["default"];

  const moveCategory = (target: string) => {
    if (!draggedCategory || draggedCategory === target) return;
    const next = [...filter.categories];
    const from = next.indexOf(draggedCategory); const to = next.indexOf(target);
    if (from < 0 || to < 0) return;
    next.splice(from, 1); next.splice(to, 0, draggedCategory);
    setCategoryOrder(next); setCategoryOrderDirty(true); setDraggedCategory(null);
  };

  const addCategory = async () => {
    if (!canWrite) return;
    const name = newCategoryName.trim();
    if (!name || categories.includes(name)) return;
    const next = [...categories, name];
    setAddingCategory(true);
    try {
      await reorderCategoriesApi({ mark, token: writeToken!, categories: next });
      setCategoryOrder(next);
      setCategoryOrderDirty(false);
      setNewCategoryName("");
      toast.success("分类已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "分类创建失败");
    } finally {
      setAddingCategory(false);
    }
  };

  const renameCurrentCategory = async (cat: string) => {
    if (!canWrite || cat === "default") return;
    const name = window.prompt("重命名分类", cat)?.trim();
    if (!name || name === cat || categories.includes(name)) return;
    try {
      await renameCategoryApi({ mark, token: writeToken!, category: cat, name });
      setCategoryOrder((previous) => [...new Set(previous.map((item) => renameCategoryPath(item, cat, name)))]);
      setData((prev) => prev ? {
        ...prev,
        bookmarks: prev.bookmarks.map((bookmark) => ({
          ...bookmark,
          category: renameCategoryPath(bookmark.category, cat, name),
        })),
      } : prev);
      setSettings((previous) => ({
        ...previous,
        defaultCategory: renameCategoryPath(previous.defaultCategory, cat, name),
        homeCategory: renameCategoryPath(previous.homeCategory, cat, name),
      }));
      setCategory((current) => current === ALL_CATEGORIES ? current : renameCategoryPath(current, cat, name));
      toast.success("分类已重命名");
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "分类重命名失败"); }
  };

  const deleteCurrentCategory = async (cat: string) => {
    if (!canWrite || cat === "default" || !window.confirm(`删除分类“${cat}”及其中的全部收藏？`)) return;
    try {
      await deleteCategoryApi({ mark, token: writeToken!, category: cat });
      setCategoryOrder(categories.filter((item) => item !== cat));
      setData((prev) => prev ? { ...prev, bookmarks: prev.bookmarks.filter((b) => b.category !== cat) } : prev);
      setSettings((previous) => ({
        ...previous,
        defaultCategory: isCategoryInTree(previous.defaultCategory, cat) ? "default" : previous.defaultCategory,
        homeCategory: isCategoryInTree(previous.homeCategory, cat) ? "" : previous.homeCategory,
      }));
      if (isCategoryInTree(category, cat)) setCategory(ALL_CATEGORIES);
      toast.success("分类及收藏已删除");
    }
    catch (e) { toast.error(e instanceof Error ? e.message : "分类删除失败"); }
  };

  const dialogOpen =
    addOpen ||
    editOpen ||
    bulkEditOpen ||
    deleteOpen ||
    helpOpen ||
    tokenOpen ||
    importExportOpen ||
    settingsOpen;
  const focused = filtered[focusedIndex] ?? null;
  /** Local token present (may still be wrong until first successful write). */
  const canWrite = Boolean(writeToken) && !isDemoMark(mark);
  /** Existing collection on another device — need paste, never silent-mint. */
  const needsWriteUnlock =
    collectionExists && !canWrite && !isDemoMark(mark) && !privateLocked;
  /** Brand-new mark: first write claims with the silently minted token. */
  const isUnclaimed = !collectionExists && !isDemoMark(mark);

  const multiCount = selectedIds.size;

  // Load collection when mark changes (token read from storage inside)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPrivateLocked(false);
    setCollectionExists(false);

    const stored = isDemoMark(mark) ? null : getStoredWriteToken(mark);
    if (!isDemoMark(mark)) {
      setWriteToken(stored);
    } else {
      setWriteToken(null);
    }

    void (async () => {
      try {
        const page = await fetchCollection(mark, stored);
        if (cancelled) return;

        setCollectionExists(Boolean(page.exists));
        const nextSettings = page.settings ?? { ...DEFAULT_COLLECTION_SETTINGS };
        const nextProfiles = page.sortProfiles ?? [];
        const nextProfile = nextProfiles.find((profile) => profile.id === nextSettings.homeSortProfile);
        setSettings(nextSettings);
        setSortProfiles(nextProfiles);
        setActiveSortProfileId(nextProfile?.id ?? null);
        setCategory(nextSettings.homeCategory || ALL_CATEGORIES);
        setSort(nextProfile ? "manual" : isFixedSortKey(nextSettings.homeSortProfile) ? nextSettings.homeSortProfile : "newest");
        setData(nextProfile && page.bookmarksData
          ? { ...page.bookmarksData, bookmarks: applySortProfile(page.bookmarksData.bookmarks, nextProfile) }
          : page.bookmarksData ?? { mark, bookmarks: [] });
        setCategoryOrder(page.categories ?? []);
        setIssuedWriteToken(page.issuedWriteToken);
        setMigratedFromKv(Boolean(page.migratedFromKv));

        if (page.privateLocked) {
          // Wrong/missing token on a private collection — force unlock gate.
          setPrivateLocked(true);
          setWriteToken(null);
          return;
        }

        setPrivateLocked(false);

        if (page.issuedWriteToken) {
          setStoredWriteToken(mark, page.issuedWriteToken);
          setWriteToken(page.issuedWriteToken);
          return;
        }

        if (page.exists) {
          // Owned collection: never silent-mint. Verify stored token or require paste.
          if (!stored) {
            setWriteToken(null);
            return;
          }
          try {
            await claimCollectionApi({ mark, token: stored });
            if (!cancelled) setWriteToken(stored);
          } catch {
            // Stale local token from another device/session — drop it.
            clearStoredWriteToken(mark);
            if (!cancelled) setWriteToken(null);
          }
          return;
        }

        // Unclaimed mark: ensure a local token so the first write can claim it.
        if (!isDemoMark(mark)) {
          setWriteToken(stored || ensureLocalWriteToken(mark));
        }
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Failed to load");
          setData({ mark, bookmarks: [] });
          setPrivateLocked(false);
          setCollectionExists(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      const token = writeToken ?? getStoredWriteToken(mark);
      const currentCategory = category;
      void fetchCollection(mark, token)
        .then((page) => {
          if (page.settings) {
            const nextProfile = page.sortProfiles?.find((profile) => profile.id === page.settings?.homeSortProfile);
            setSettings(page.settings);
            setActiveSortProfileId(nextProfile?.id ?? null);
            setSort(nextProfile ? "manual" : isFixedSortKey(page.settings.homeSortProfile) ? page.settings.homeSortProfile : "newest");
            if (page.bookmarksData) setData({ ...page.bookmarksData, bookmarks: nextProfile ? applySortProfile(page.bookmarksData.bookmarks, nextProfile) : page.bookmarksData.bookmarks });
          } else if (page.bookmarksData) setData(page.bookmarksData);
          if (page.bookmarksData) setData(page.bookmarksData);
          const categoryStillExists =
            currentCategory === ALL_CATEGORIES ||
            page.categories?.some((item) =>
              isCategoryInTree(item, currentCategory),
            ) ||
            page.bookmarksData?.bookmarks.some((bookmark) =>
              isCategoryInTree(bookmark.category, currentCategory),
            );
          setCategory(categoryStillExists ? currentCategory : ALL_CATEGORIES);
        })
        .catch(() => {
          /* ignore refresh errors */
        });
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, t, mark, writeToken, category, setCategory]);

  // Clamp focus when filter changes; drop selection entries not in filtered
  useEffect(() => {
    setFocusedIndex((i) => {
      if (filtered.length === 0) return 0;
      return Math.min(i, filtered.length - 1);
    });
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(filtered.map((b) => b.uuid));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  // Scroll focused row into view
  useEffect(() => {
    const el = listRef.current?.querySelector(
      `[data-uuid="${focused?.uuid}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [focused?.uuid]);

  const openFocused = useCallback(() => {
    if (focused) window.open(focused.url, "_blank", "noopener,noreferrer");
  }, [focused]);

  const selectOnly = useCallback((index: number) => {
    const b = filtered[index];
    if (!b) return;
    setFocusedIndex(index);
    setAnchorIndex(index);
    // Always exclusive — plain click never accumulates
    setSelectedIds(new Set([b.uuid]));
  }, [filtered]);

  /** Additive toggle for checkbox / ⌘-click multi-select */
  const toggleId = useCallback((uuid: string, index: number) => {
    setFocusedIndex(index);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
        // Keep anchor on remaining selection if possible
        if (next.size === 0) {
          setAnchorIndex(index);
        }
      } else {
        next.add(uuid);
        // First item of a multi-select session becomes the range anchor
        if (prev.size === 0) setAnchorIndex(index);
      }
      return next;
    });
  }, []);

  const selectRange = useCallback(
    (toIndex: number) => {
      if (filtered.length === 0) return;
      const from = anchorIndex;
      const start = Math.min(from, toIndex);
      const end = Math.max(from, toIndex);
      setFocusedIndex(toIndex);
      setSelectedIds(() => {
        const next = new Set<string>();
        for (let i = start; i <= end; i++) {
          const b = filtered[i];
          if (b) next.add(b.uuid);
        }
        return next;
      });
    },
    [anchorIndex, filtered],
  );

  const moveFocus = useCallback(
    (delta: number, opts?: { extend?: boolean }) => {
      if (filtered.length === 0) return;
      setFocusedIndex((i) => {
        let next = i + delta;
        if (next < 0) next = filtered.length - 1;
        if (next >= filtered.length) next = 0;

        if (opts?.extend) {
          // Range-select from anchor → multi-select mode
          const from = anchorIndex;
          const start = Math.min(from, next);
          const end = Math.max(from, next);
          setSelectedIds(() => {
            const s = new Set<string>();
            for (let j = start; j <= end; j++) {
              const b = filtered[j];
              if (b) s.add(b.uuid);
            }
            return s;
          });
        } else {
          // Plain nav:
          // - single-select mode (0–1 items): cursor carries the selection
          // - multi-select mode (2+): only move focus, keep the set
          setSelectedIds((prev) => {
            if (prev.size > 1) return prev;
            const b = filtered[next];
            return b ? new Set([b.uuid]) : prev;
          });
          setAnchorIndex(next);
        }
        return next;
      });
    },
    [filtered, anchorIndex],
  );

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(new Set(filtered.map((b) => b.uuid)));
  }, [filtered]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const clearFilters = useCallback(() => {
    setQuery("");
    setCategory(ALL_CATEGORIES);
    searchRef.current?.blur();
  }, [setQuery, setCategory]);

  const onTokenReady = useCallback((token: string | null) => {
    setWriteToken(token);
    // Paste/claim paths bind an owned collection to this device.
    if (token) setCollectionExists(true);
  }, []);

  const applyCollectionPage = useCallback(
    (page: Awaited<ReturnType<typeof fetchCollection>>, token: string | null) => {
      setCollectionExists(Boolean(page.exists));
      setPrivateLocked(Boolean(page.privateLocked));
      const nextSettings = page.settings ?? { ...DEFAULT_COLLECTION_SETTINGS };
      setSettings(nextSettings);
      setCategory(nextSettings.homeCategory || ALL_CATEGORIES);
      setSortProfiles(page.sortProfiles ?? []);
      const profile = page.sortProfiles?.find((item) => item.id === nextSettings.homeSortProfile);
      setActiveSortProfileId(profile?.id ?? null);
      setSort(profile ? "manual" : isFixedSortKey(nextSettings.homeSortProfile) ? nextSettings.homeSortProfile : "newest");
      setData(page.bookmarksData ? { ...page.bookmarksData, bookmarks: applySortProfile(page.bookmarksData.bookmarks, profile) } : { mark, bookmarks: [] });
      setCategoryOrder(page.categories ?? []);
      setIssuedWriteToken(page.issuedWriteToken);
      setMigratedFromKv(Boolean(page.migratedFromKv));
      if (page.issuedWriteToken) {
        setStoredWriteToken(mark, page.issuedWriteToken);
        setWriteToken(page.issuedWriteToken);
      } else if (token) {
        setWriteToken(token);
      }
    },
    [mark],
  );

  /** Private gate + public attach: verify token then enable this device. */
  const unlockWithToken = useCallback(
    async (token: string) => {
      if (privateLocked || collectionExists) {
        // Existing collection: verify ownership via claim (no-op if already owner).
        // For private, also re-fetch bookmarks with the token.
        try {
          await claimCollectionApi({ mark, token });
        } catch {
          // claim fails when token mismatches an existing collection
          throw new Error(tset("privateInvalid"));
        }
        const page = await fetchCollection(mark, token);
        if (page.privateLocked) {
          throw new Error(tset("privateInvalid"));
        }
        applyCollectionPage(page, token);
        return;
      }
      // Should not reach for unclaimed — those use silent mint.
      setStoredWriteToken(mark, token);
      setWriteToken(token);
    },
    [privateLocked, collectionExists, mark, tset, applyCollectionPage],
  );

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

  const refreshCollection = useCallback(async () => {
    const currentCategory = category;
    setRefreshing(true);
    try {
      const page = await fetchCollection(
        mark,
        writeToken ?? getStoredWriteToken(mark),
      );
      applyCollectionPage(page, writeToken);
      const categoryStillExists =
        currentCategory === ALL_CATEGORIES ||
        page.categories?.some((item) =>
          isCategoryInTree(item, currentCategory),
        ) ||
        page.bookmarksData?.bookmarks.some((bookmark) =>
          isCategoryInTree(bookmark.category, currentCategory),
        );
      setCategory(categoryStillExists ? currentCategory : ALL_CATEGORIES);
      toast.success("收藏页已刷新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "刷新失败");
    } finally {
      setRefreshing(false);
    }
  }, [applyCollectionPage, category, mark, setCategory, writeToken]);

  const onBookmarkAdded = useCallback(
    (bookmark: BookmarkInstance) => {
      const wasUnclaimed = !collectionExists;
      setData((prev) => {
        if (!prev) return { mark, bookmarks: [bookmark] };
        return { ...prev, bookmarks: [...prev.bookmarks, bookmark] };
      });
      if (wasUnclaimed) {
        setCollectionExists(true);
        if (!isTokenBackupAcknowledged(mark)) {
          toast.message(t("backupAfterClaim"), {
            action: {
              label: t("tokenManager"),
              onClick: () => setTokenOpen(true),
            },
          });
        }
      }
    },
    [mark, collectionExists, t],
  );

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

  const onBookmarksUpdated = useCallback((updated: BookmarkInstance[]) => {
    if (updated.length === 0) return;
    const map = new Map(updated.map((b) => [b.uuid, b]));
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        bookmarks: prev.bookmarks.map((b) => map.get(b.uuid) ?? b),
      };
    });
  }, []);

  const onBookmarksDeleted = useCallback((uuids: string[]) => {
    const gone = new Set(uuids);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        bookmarks: prev.bookmarks.filter((b) => !gone.has(b.uuid)),
      };
    });
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => !gone.has(id)));
      return next;
    });
  }, []);

  const openDeleteFor = useCallback(
    (targets: BookmarkInstance[]) => {
      if (targets.length === 0) return;
      if (!canWrite) {
        toast.error(t("notifications.tokenRequired"));
        return;
      }
      // Ensure focused/selected state covers targets for the dialog
      if (targets.length === 1) {
        const idx = filtered.findIndex((b) => b.uuid === targets[0]!.uuid);
        if (idx >= 0) {
          setFocusedIndex(idx);
          setSelectedIds(new Set([targets[0]!.uuid]));
        }
      }
      setDeleteOpen(true);
    },
    [canWrite, filtered, t],
  );

  const selectedTargets = useCallback((): BookmarkInstance[] => {
    if (selectedIds.size > 0) {
      return filtered.filter((b) => selectedIds.has(b.uuid));
    }
    return focused ? [focused] : [];
  }, [selectedIds, filtered, focused]);

  const openEditForSelection = useCallback(() => {
    if (!canWrite) {
      toast.error(t("notifications.tokenRequired"));
      return;
    }
    const targets = selectedTargets();
    if (targets.length === 0) return;
    if (targets.length === 1) {
      const idx = filtered.findIndex((b) => b.uuid === targets[0]!.uuid);
      if (idx >= 0) setFocusedIndex(idx);
      setEditOpen(true);
      return;
    }
    setBulkEditOpen(true);
  }, [canWrite, selectedTargets, filtered, t]);

  const shortcutItems: ShortcutItem[] = useMemo(
    () => [
      { keys: ["/", "⌘K"], label: ts("focusSearch") },
      { keys: ["j", "↓"], label: ts("next") },
      { keys: ["k", "↑"], label: ts("prev") },
      { keys: ["Shift+j/k"], label: ts("extendSelect") },
      { keys: ["x", "Space"], label: ts("toggleSelect") },
      { keys: ["a"], label: ts("selectAll") },
      { keys: ["Enter", "o"], label: ts("open") },
      { keys: ["n"], label: ts("add") },
      { keys: ["e"], label: ts("edit") },
      { keys: ["d"], label: ts("delete") },
      { keys: ["0–9"], label: ts("filterCategory") },
      { keys: ["Esc"], label: ts("clear") },
      { keys: ["?"], label: ts("help") },
      { keys: ["⇧T"], label: ts("theme") },
    ],
    [ts],
  );

  const hotkeys: HotkeyBinding[] = useMemo(() => {
    // Delete dialog owns d / Enter / Escape via its own hook
    if (deleteOpen) return [];

    if (dialogOpen) {
      return [
        {
          key: "Escape",
          allowInInput: true,
          handler: () => {
            setAddOpen(false);
            setEditOpen(false);
            setBulkEditOpen(false);
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
        handler: () => moveFocus(1),
      },
      {
        key: "ArrowDown",
        handler: () => moveFocus(1),
      },
      {
        key: "j",
        shift: true,
        handler: () => moveFocus(1, { extend: true }),
      },
      {
        key: "ArrowDown",
        shift: true,
        handler: () => moveFocus(1, { extend: true }),
      },
      {
        key: "k",
        handler: () => moveFocus(-1),
      },
      {
        key: "ArrowUp",
        handler: () => moveFocus(-1),
      },
      {
        key: "k",
        shift: true,
        handler: () => moveFocus(-1, { extend: true }),
      },
      {
        key: "ArrowUp",
        shift: true,
        handler: () => moveFocus(-1, { extend: true }),
      },
      {
        key: " ",
        handler: () => {
          if (!focused) return;
          toggleId(focused.uuid, focusedIndex);
        },
      },
      {
        key: "x",
        handler: () => {
          if (!focused) return;
          toggleId(focused.uuid, focusedIndex);
        },
      },
      {
        key: "a",
        handler: () => selectAllFiltered(),
      },
      {
        key: "a",
        meta: true,
        handler: () => selectAllFiltered(),
      },
      {
        key: "Enter",
        handler: () => openFocused(),
      },
      {
        key: "o",
        handler: () => openFocused(),
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
        handler: () => openEditForSelection(),
      },
      {
        key: "d",
        handler: () => openDeleteFor(selectedTargets()),
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
          if (selectedIds.size > 0) {
            clearSelection();
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
    deleteOpen,
    dialogOpen,
    moveFocus,
    openFocused,
    canWrite,
    focused,
    focusedIndex,
    toggleId,
    selectAllFiltered,
    openDeleteFor,
    openEditForSelection,
    selectedTargets,
    t,
    query,
    setQuery,
    clearFilters,
    clearSelection,
    setCategory,
    filter.categories,
  ]);

  useHotkeys(hotkeys);

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-card/50 shadow-elevated">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
        <span className="text-sm">{t("loading")}</span>
      </div>
    );
  }

  if (privateLocked) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full rounded-2xl border border-border/70 bg-card/60 p-6 shadow-elevated backdrop-blur-sm">
          <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="font-display text-lg font-semibold tracking-tight">
            {tset("privateTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tset("privateDescription")}
          </p>
          <TokenUnlockForm
            className="mt-4"
            mark={mark}
            initialToken={getStoredWriteToken(mark) || ""}
            submitLabel={tset("privateUnlock")}
            autoFocus
            onUnlock={unlockWithToken}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 py-4 sm:px-4 sm:py-5">
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

      {needsWriteUnlock && (
        <div className="mb-3 rounded-xl border border-border/70 bg-card/60 px-3 py-3 shadow-sm">
          <div className="mb-2 flex items-start gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium leading-tight">
                {t("needsTokenTitle")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("needsTokenDescription")}
              </p>
            </div>
          </div>
          <TokenUnlockForm
            mark={mark}
            compact
            submitLabel={tset("privateUnlock")}
            onUnlock={unlockWithToken}
          />
        </div>
      )}

      {isUnclaimed && canWrite && (
        <p className="mb-3 text-2xs text-muted-foreground">{t("unclaimedHint")}</p>
      )}

      {/* Header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {t("title")}
            <span className="ml-2 font-mono text-base font-normal text-muted-foreground">
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
              className="h-8 rounded-full"
              onClick={() => setTokenOpen(true)}
              title={t("tokenManager")}
            >
              <KeyRound className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("tokenManager")}</span>
            </Button>
          )}
          {!isDemoMark(mark) && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-full"
              disabled={!canWrite}
              onClick={() => setSettingsOpen(true)}
              title={tset("button")}
            >
              <Settings2 className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tset("button")}</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 rounded-full"
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
            className="h-8 rounded-full shadow-glow"
            disabled={!canWrite}
            onClick={() => setAddOpen(true)}
            title={!canWrite ? t("needsTokenTitle") : undefined}
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
        <aside className="hidden w-48 shrink-0 flex-col md:flex">
          <div className="mb-2 flex items-center gap-1.5 px-2.5 text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Folder className="h-3 w-3" />
            {ts("categories")}
          </div>
          <nav className="space-y-1 rounded-xl border border-border/60 bg-card/50 p-1.5 shadow-sm backdrop-blur-sm">
            <CategoryButton
              active={category === ALL_CATEGORIES}
              label={ts("all")}
              count={filter.total}
              shortcut="0"
              onClick={() => setCategory(ALL_CATEGORIES)}
            />
            {buildCategoryTree(filter.categories).map((node, i) => (
              <CategoryTreeItem
                key={node.path}
                node={node}
                activeCategory={category}
                counts={filter.categoryCounts}
                managedCategories={filter.categories}
                shortcut={i < 9 ? String(i + 1) : undefined}
                canWrite={canWrite}
                onSelect={setCategory}
                onDragStart={setDraggedCategory}
                onDragOver={(event) => event.preventDefault()}
                onDrop={moveCategory}
                onRename={(cat) => void renameCurrentCategory(cat)}
                onDelete={(cat) => void deleteCurrentCategory(cat)}
              />
            ))}
            {canWrite ? (
              <form className="mt-1 flex gap-1" onSubmit={(event) => { event.preventDefault(); void addCategory(); }}>
                <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="新建分类" className="h-8 min-w-0 text-xs" maxLength={50} disabled={addingCategory} />
                <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0 px-2" disabled={!newCategoryName.trim() || addingCategory}>＋</Button>
              </form>
            ) : (
              <p className="mt-1 px-2 py-1.5 text-2xs text-muted-foreground">演示集合为只读</p>
            )}
          </nav>
        </aside>

        {/* Main list */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/70 bg-card/50 shadow-elevated backdrop-blur-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/25 px-2.5 py-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ts("searchPlaceholder")}
                className="h-8 rounded-lg border-border/60 bg-background/80 pl-7 pr-16 text-sm"
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

            <Select value={activeSortProfileId ?? sort} onValueChange={selectHomeSort}>
              <SelectTrigger className="h-8 w-[8.5rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{ts("sortManual")}</SelectItem>
                <SelectItem value="newest">{ts("sortNewest")}</SelectItem>
                <SelectItem value="oldest">{ts("sortOldest")}</SelectItem>
                <SelectItem value="title">{ts("sortTitleAsc")}</SelectItem>
                <SelectItem value="title-desc">{ts("sortTitleDesc")}</SelectItem>
                <SelectItem value="category">
                  {ts("sortCategoryAsc")}
                </SelectItem>
                <SelectItem value="category-desc">
                  {ts("sortCategoryDesc")}
                </SelectItem>
                <SelectItem value="url">{ts("sortUrlAsc")}</SelectItem>
                <SelectItem value="url-desc">{ts("sortUrlDesc")}</SelectItem>
                {sortProfiles.length > 0 && sortProfiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => void refreshCollection()}
              disabled={refreshing}
              title="刷新收藏页"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              <span className="sr-only">刷新收藏页</span>
            </Button>
            {canWrite && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => void manageSortProfile("create")}>＋</Button>
                <Button size="sm" variant="ghost" className="h-8 px-2" disabled={!activeSortProfileId} onClick={() => void manageSortProfile("rename")}>✎</Button>
                <Button size="sm" variant="ghost" className="h-8 px-2" disabled={!activeSortProfileId} onClick={() => void manageSortProfile("delete")}>×</Button>
              </div>
            )}

            {(Object.keys(pendingOrders).length > 0 || categoryOrderDirty) && (
              <>
                <span className="text-2xs text-amber-600 dark:text-amber-400">
                  {ts("reorderUnsaved")}
                </span>
                <Button
                  size="sm"
                  className="h-8 rounded-full"
                  disabled={savingOrder}
                  onClick={() => void savePendingOrders()}
                >
                  {savingOrder ? ts("reorderSaving") : ts("saveOrder")}
                </Button>
              </>
            )}

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

          {/* Bulk selection bar */}
          {multiCount > 1 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-primary/25 bg-primary/8 px-2.5 py-2 text-xs">
              <span className="font-medium">
                {ts("selectedCount", { count: multiCount })}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={selectAllFiltered}
              >
                {ts("selectAll")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={clearSelection}
              >
                {ts("clearSelection")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={!canWrite}
                onClick={() => openEditForSelection()}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                {ts("editSelected")}
                <kbd className="ml-1.5">e</kbd>
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="ml-auto h-7"
                disabled={!canWrite}
                onClick={() =>
                  openDeleteFor(
                    filtered.filter((b) => selectedIds.has(b.uuid)),
                  )
                }
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {ts("deleteSelected")}
                <kbd className="ml-1.5 border-destructive-foreground/30 bg-destructive-foreground/10">
                  d
                </kbd>
              </Button>
            </div>
          )}

          {/* Column headers — click to sort; same grid as BookmarkRow */}
          <div
            className={cn(
              "hidden items-center gap-x-3 border-b border-border/60 bg-muted/15 px-3 py-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid",
              BOOKMARK_ROW_GRID,
            )}
          >
            <span className="justify-self-center" aria-hidden />
            <span className="justify-self-center" aria-hidden />
            <SortHeader
              label={ts("colTitle")}
              column="title"
              activeColumn={sortColumn}
              dir={sortDir}
              onToggle={toggleSortColumn}
              className="justify-self-start"
            />
            <SortHeader
              label={ts("colCategory")}
              column="category"
              activeColumn={sortColumn}
              dir={sortDir}
              onToggle={toggleSortColumn}
              className="justify-self-start"
            />
            <SortHeader
              label={ts("colDate")}
              column="date"
              activeColumn={sortColumn}
              dir={sortDir}
              onToggle={toggleSortColumn}
              className="justify-self-end"
            />
            <span className="justify-self-end w-[5.25rem]" aria-hidden />
          </div>

          <div
            ref={listRef}
            role="listbox"
            aria-multiselectable
            aria-label={t("title")}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 px-4 py-20 text-center">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-muted-foreground/70">
                  <Search className="h-6 w-6" />
                </div>
                <p className="max-w-xs text-sm text-muted-foreground">
                  {bookmarks.length === 0 ? t("noBookmarks") : ts("noResults")}
                </p>
                {bookmarks.length === 0 && canWrite && (
                  <Button size="sm" className="rounded-full" onClick={() => setAddOpen(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {t("addFirstBookmark")}
                  </Button>
                )}
                {bookmarks.length === 0 && !canWrite && !needsWriteUnlock && (
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link to="/doc">{t("createOwn")}</Link>
                  </Button>
                )}
                {bookmarks.length === 0 && needsWriteUnlock && (
                  <p className="max-w-xs text-2xs text-muted-foreground">
                    {t("needsTokenDescription")}
                  </p>
                )}
              </div>
            ) : (
              filtered.map((bookmark, index) => (
                <BookmarkRow
                  key={bookmark.uuid}
                  bookmark={bookmark}
                  selected={selectedIds.has(bookmark.uuid)}
                  focused={index === focusedIndex}
                  canWrite={canWrite}
                  onSelect={(e) => {
                    // Multi-select only with explicit modifiers / checkbox.
                    // Plain click is always exclusive single-select.
                    if (e.shiftKey) {
                      e.preventDefault();
                      selectRange(index);
                      return;
                    }
                    if (e.metaKey || e.ctrlKey) {
                      e.preventDefault();
                      toggleId(bookmark.uuid, index);
                      return;
                    }
                    selectOnly(index);
                  }}
                  onToggle={() => toggleId(bookmark.uuid, index)}
                  onOpen={() =>
                    window.open(bookmark.url, "_blank", "noopener,noreferrer")
                  }
                  onEdit={() => {
                    selectOnly(index);
                    setEditOpen(true);
                  }}
                  onDelete={() => {
                    openDeleteFor([bookmark]);
                  }}
                  reorderable={manualSort && canWrite}
                  onDragStart={() => {
                    setDraggedUuid(bookmark.uuid);
                    setDragOverUuid(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverUuid(bookmark.uuid);
                  }}
                  onDrop={() => {
                    setDragOverUuid(null);
                    reorder(bookmark.uuid);
                  }}
                  dragging={draggedUuid === bookmark.uuid}
                  dragOver={dragOverUuid === bookmark.uuid && draggedUuid !== bookmark.uuid}
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
        bookmark={focused}
        categories={categories}
        writeToken={writeToken}
        open={editOpen}
        onOpenChange={setEditOpen}
        onBookmarkUpdated={onBookmarkUpdated}
      />
      <DialogBulkEdit
        mark={mark}
        bookmarks={filtered.filter((b) => selectedIds.has(b.uuid))}
        categories={categories}
        writeToken={writeToken}
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        onBookmarksUpdated={onBookmarksUpdated}
      />
      <DialogDelete
        mark={mark}
        bookmarks={
          selectedIds.size > 0
            ? filtered.filter((b) => selectedIds.has(b.uuid))
            : focused
              ? [focused]
              : []
        }
        writeToken={writeToken}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onBookmarksDeleted={onBookmarksDeleted}
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
        categories={categories}
      />
      {!isDemoMark(mark) && (
        <CollectionSettingsDialog
          mark={mark}
          writeToken={writeToken}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          categories={categories}
          sortProfiles={sortProfiles}
          onSaved={(next) => {
            setSettings(next);
            setCategory(next.homeCategory || ALL_CATEGORIES);
            const profile = sortProfiles.find((item) => item.id === next.homeSortProfile);
            setActiveSortProfileId(profile?.id ?? null);
            setSort(profile ? "manual" : isFixedSortKey(next.homeSortProfile) ? next.homeSortProfile : "newest");
            setData((previous) => previous ? { ...previous, bookmarks: applySortProfile(previous.bookmarks, profile) } : previous);
          }}
        />
      )}
    </div>
  );
}

function CategoryButton({
  active,
  label,
  count,
  shortcut,
  onClick,
  onRename,
  onDelete,
  indent = 0,
  parent = false,
  expanded = false,
}: {
  active: boolean;
  label: string;
  count: number;
  shortcut?: string;
  onClick: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  indent?: number;
  parent?: boolean;
  expanded?: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onClick(); } }}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group/cat flex w-full items-center gap-2 rounded-lg py-2 text-left text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        indent ? "pl-1.5 pr-2" : "px-2.5",
        active
          ? "bg-primary font-semibold text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/90 hover:text-foreground",
      )}
    >
      <GripVertical className="h-3 w-3 shrink-0 opacity-40" aria-hidden />
      {parent ? (expanded ? <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden /> : <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />) : <span className="h-3 w-3 shrink-0" />}
      {parent && <Folder className="h-3 w-3 shrink-0 opacity-60" aria-hidden />}
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
          active ? "bg-primary-foreground" : "bg-border group-hover/cat:bg-muted-foreground/50",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 tabular-nums text-2xs font-medium",
          active
            ? "bg-primary-foreground/15 text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
      {shortcut ? (
        <kbd
          className={cn(
            "ml-0.5 hidden opacity-80 lg:inline-flex",
            active && "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground",
          )}
        >
          {shortcut}
        </kbd>
      ) : null}
      {onRename && <button type="button" className="ml-1 hidden text-[10px] opacity-60 group-hover/cat:inline" onClick={(event) => { event.stopPropagation(); onRename(); }}>改</button>}
      {onDelete && <button type="button" className="hidden text-[10px] text-destructive opacity-70 group-hover/cat:inline" onClick={(event) => { event.stopPropagation(); onDelete(); }}>删</button>}
    </div>
  );
}

function buildCategoryTree(categories: string[]) {
  type Node = { name: string; path: string; children: Node[] };
  const roots: Node[] = [];
  const nodes = new Map<string, Node>();
  for (const category of categories) {
    const parts = category.split(" / ");
    let parent: Node | undefined;
    let path = "";
    for (const part of parts) {
      path = path ? `${path} / ${part}` : part;
      let node = nodes.get(path);
      if (!node) {
        node = { name: part, path, children: [] };
        nodes.set(path, node);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      parent = node;
    }
  }
  return roots;
}

type CategoryTreeNode = ReturnType<typeof buildCategoryTree>[number];

function CategoryTreeItem({
  node,
  activeCategory,
  counts,
  managedCategories,
  shortcut,
  canWrite,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onRename,
  onDelete,
}: {
  node: CategoryTreeNode;
  activeCategory: string;
  counts: Map<string, number>;
  managedCategories: string[];
  shortcut?: string;
  canWrite: boolean;
  onSelect: (category: string) => void;
  onDragStart: (category: string) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (category: string) => void;
  onRename: (category: string) => void;
  onDelete: (category: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const count = [...counts.entries()]
    .filter(([category]) => isCategoryInTree(category, node.path))
    .reduce((total, [, value]) => total + value, 0);
  const isParent = node.children.length > 0;
  const isManaged = managedCategories.includes(node.path);
  const isFolderPath = isManaged || isParent;
  return (
    <div
      className="group/category relative"
      draggable={canWrite && isManaged}
      onDragStart={() => isManaged && onDragStart(node.path)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(node.path)}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (isParent) setExpanded((value) => !value);
      }}
    >
      <CategoryButton
        active={activeCategory === node.path}
        label={node.name}
        count={count}
        shortcut={shortcut}
        indent={node.path.includes(" / ") ? 1 : 0}
        parent={isParent}
        onClick={() => onSelect(node.path)}
        onRename={!isFolderPath || node.path === "default" ? undefined : () => onRename(node.path)}
        onDelete={!isFolderPath || node.path === "default" ? undefined : () => onDelete(node.path)}
        expanded={expanded}
      />
      {expanded && node.children.length > 0 && (
        <div className="ml-3 border-l border-border/40 pl-1">
          {node.children.map((child) => (
            <CategoryTreeItem
              key={child.path}
              node={child}
              activeCategory={activeCategory}
              counts={counts}
              managedCategories={managedCategories}
              canWrite={canWrite}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  column,
  activeColumn,
  dir,
  onToggle,
  className,
}: {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  dir: "asc" | "desc";
  onToggle: (column: SortColumn) => void;
  className?: string;
}) {
  const active = activeColumn === column;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-muted hover:text-foreground",
        active && "text-foreground",
        className,
      )}
      aria-sort={
        active ? (dir === "asc" ? "ascending" : "descending") : "none"
      }
      title={label}
    >
      <span>{label}</span>
      {active ? (
        dir === "asc" ? (
          <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" />
      )}
    </button>
  );
}
