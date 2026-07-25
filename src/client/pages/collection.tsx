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
  Plus,
  Search,
  Pencil,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BookmarkInstance,
  BookmarksData,
  CollectionSettings,
} from "@/shared/types";
import {
  DEFAULT_COLLECTION_SETTINGS,
  isDemoMark,
} from "@/shared/types";
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
import { claimCollectionApi, fetchCollection } from "@/client/lib/api";
import {
  clearStoredWriteToken,
  ensureLocalWriteToken,
  getStoredWriteToken,
  isTokenBackupAcknowledged,
  setStoredWriteToken,
} from "@/client/lib/token-store";
import {
  ALL_CATEGORIES,
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
  const [privateLocked, setPrivateLocked] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const baseUrl = getBaseUrl();
  const bookmarks = data?.bookmarks ?? [];
  const filter = useBookmarkFilter(bookmarks);
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

  const categories = useMemo(
    () => (data ? getCategories(data) : ["default"]),
    [data],
  );

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
        setSettings(page.settings ?? { ...DEFAULT_COLLECTION_SETTINGS });
        setData(
          page.bookmarksData ?? {
            mark,
            bookmarks: [],
          },
        );
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
      void fetchCollection(mark, token)
        .then((page) => {
          if (page.bookmarksData) setData(page.bookmarksData);
          if (page.settings) setSettings(page.settings);
        })
        .catch(() => {
          /* ignore refresh errors */
        });
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, t, mark, writeToken]);

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
      setSettings(page.settings ?? { ...DEFAULT_COLLECTION_SETTINGS });
      setData(page.bookmarksData ?? { mark, bookmarks: [] });
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

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="h-8 w-[8.5rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
      />
      {!isDemoMark(mark) && (
        <CollectionSettingsDialog
          mark={mark}
          writeToken={writeToken}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={settings}
          onSaved={setSettings}
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
      aria-current={active ? "true" : undefined}
      className={cn(
        "group/cat flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary font-semibold text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted/90 hover:text-foreground",
      )}
    >
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
    </button>
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
