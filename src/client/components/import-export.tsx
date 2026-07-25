import { useMemo, useRef, useState } from "react";
import {
  Download,
  FileUp,
  Loader2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BookmarkInstance } from "@/shared/types";
import {
  exportCloudmarkJson,
  exportNetscapeHtml,
  parseBookmarkFile,
  type ParsedBookmark,
} from "@/shared/netscape-bookmarks";
import { downloadJson, downloadTextFile } from "@/client/lib/download";
import { importBookmarksApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_MAX_LENGTH } from "@/shared/constants";
import { MAX_BOOKMARKS_PER_MARK } from "@/shared/constants";

interface ImportExportProps {
  mark: string;
  writeToken: string | null;
  bookmarks: BookmarkInstance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (bookmarks: BookmarkInstance[]) => void;
  categories: string[];
}

const CHUNK = 200;

function resolveImportCategory(source: string, target: string): string {
  if (target === "parsed") return source;
  const normalized = source === "default" ? "" : source;
  const combined = normalized ? `${target} / ${normalized}` : target;
  return combined.slice(0, CATEGORY_MAX_LENGTH);
}

interface FolderNode {
  name: string;
  path: string;
  bookmarks: Array<{ item: ParsedBookmark; index: number }>;
  children: FolderNode[];
}

function buildFolderTree(items: ParsedBookmark[]): FolderNode[] {
  const roots: FolderNode[] = [];
  const nodes = new Map<string, FolderNode>();
  for (const [index, item] of items.entries()) {
    const parts = item.category.split(" / ").filter(Boolean);
    let parent: FolderNode | undefined;
    let path = "";
    for (const part of parts.length ? parts : ["default"]) {
      path = path ? `${path} / ${part}` : part;
      let node = nodes.get(path);
      if (!node) {
        node = { name: part, path, bookmarks: [], children: [] };
        nodes.set(path, node);
        if (parent) parent.children.push(node);
        else roots.push(node);
      }
      parent = node;
    }
    parent?.bookmarks.push({ item, index });
  }
  return roots;
}

function collectFolderIndexes(node: FolderNode): number[] {
  return [
    ...node.bookmarks.map(({ index }) => index),
    ...node.children.flatMap(collectFolderIndexes),
  ];
}

function FolderTreeItem({
  node,
  selectedIndexes,
  disabled,
  onToggle,
}: {
  node: FolderNode;
  selectedIndexes: Set<number>;
  disabled: boolean;
  onToggle: (indexes: number[]) => void;
}) {
  const indexes = collectFolderIndexes(node);
  const allSelected = indexes.length > 0 && indexes.every((index) => selectedIndexes.has(index));
  const toggleOne = (index: number) => onToggle([index]);
  return (
    <li className="min-w-0 overflow-hidden">
      <div className="flex min-w-0 items-center gap-2 rounded px-1 py-1 font-medium hover:bg-muted/60">
        <input className="shrink-0" type="checkbox" checked={allSelected} disabled={disabled} onChange={() => onToggle(indexes)} />
        <span className="min-w-0 flex-1 truncate" title={node.path}>📁 {node.name}</span>
        <span className="shrink-0 tabular-nums opacity-60">{indexes.length}</span>
      </div>
      <ul className="ml-4 space-y-1 border-l border-border/50 pl-2">
        {node.bookmarks.map(({ item, index }) => (
          <li key={`${item.url}-${index}`} className="flex min-w-0 items-start gap-2 overflow-hidden rounded px-1 py-1 hover:bg-muted/60">
            <input className="mt-0.5 shrink-0" type="checkbox" checked={selectedIndexes.has(index)} disabled={disabled} onChange={() => toggleOne(index)} />
            <span className="block min-w-0 flex-1 truncate" title={`${item.category} / ${item.title}`}>{item.title}</span>
          </li>
        ))}
        {node.children.map((child) => (
          <FolderTreeItem key={child.path} node={child} selectedIndexes={selectedIndexes} disabled={disabled} onToggle={onToggle} />
        ))}
      </ul>
    </li>
  );
}

export function ImportExportDialog({
  mark,
  writeToken,
  bookmarks,
  open,
  onOpenChange,
  onImported,
  categories,
}: ImportExportProps) {
  const t = useTranslations("ImportExport");
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"export" | "import">("export");
  const [preview, setPreview] = useState<ParsedBookmark[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [targetCategory, setTargetCategory] = useState("parsed");
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
    () => new Set(),
  );
  const folderTree = useMemo(
    () => (preview ? buildFolderTree(preview) : []),
    [preview],
  );

  const resetImport = () => {
    setPreview(null);
    setFileName("");
    setProgress("");
    setTargetCategory("parsed");
    setSelectedIndexes(new Set());
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetImport();
      setTab("export");
    }
    onOpenChange(next);
  };

  const handleExportHtml = () => {
    const html = exportNetscapeHtml(bookmarks, mark);
    downloadTextFile(
      `cloudmark-${mark}-bookmarks.html`,
      html,
      "text/html;charset=utf-8",
    );
    toast.success(t("exportHtmlDone", { count: bookmarks.length }));
  };

  const handleExportJson = () => {
    const data = exportCloudmarkJson(mark, bookmarks);
    downloadJson(`cloudmark-${mark}-bookmarks.json`, data);
    toast.success(t("exportJsonDone", { count: bookmarks.length }));
  };

  const onFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseBookmarkFile(text);
      if (parsed.length === 0) {
        toast.error(t("emptyFile"));
        return;
      }
      setPreview(parsed);
      setSelectedIndexes(new Set());
      setFileName(file.name);
      toast.message(t("previewReady", { count: parsed.length }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("parseFailed"));
    }
  };

  const runImport = async () => {
    if (!preview?.length || selectedIndexes.size === 0) return;
    if (!writeToken) {
      toast.error(t("tokenRequired"));
      return;
    }
    if (bookmarks.length + selectedIndexes.size > MAX_BOOKMARKS_PER_MARK) {
      toast.error(
        t("capacityExceeded", {
          current: bookmarks.length,
          selected: selectedIndexes.size,
          maximum: MAX_BOOKMARKS_PER_MARK,
        }),
      );
      return;
    }
    setBusy(true);
    let importedTotal = 0;
    let skippedTotal = 0;
    let failedTotal = 0;
    const allNew: BookmarkInstance[] = [];

    try {
      const selected = preview.filter((_, index) => selectedIndexes.has(index));
      for (let i = 0; i < selected.length; i += CHUNK) {
        const chunk = selected.slice(i, i + CHUNK);
        setProgress(
          t("importProgress", {
            current: Math.min(i + chunk.length, selected.length),
            total: selected.length,
          }),
        );
        const result = await importBookmarksApi({
          mark,
          token: writeToken,
          skipDuplicates: true,
          bookmarks: chunk.map((b) => ({
            url: b.url,
            title: b.title,
            description: b.description,
            category: resolveImportCategory(b.category, targetCategory),
            createdAt:
              b.addDate != null
                ? new Date(b.addDate * 1000).toISOString()
                : undefined,
          })),
        });
        importedTotal += result.imported;
        skippedTotal += result.skipped;
        failedTotal += result.failed;
        allNew.push(...result.bookmarks);
      }

      onImported(allNew);
      toast.success(
        t("importDone", {
          imported: importedTotal,
          skipped: skippedTotal,
          failed: failedTotal,
        }),
      );
      handleOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("importFailed"));
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(90vh,900px)] w-[calc(100vw-2rem)] max-w-none flex-col overflow-hidden p-4 sm:w-[min(960px,calc(100vw-2rem))] sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileUp className="h-4 w-4" />
            {t("title")}
          </DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5">
          <button
            type="button"
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "export"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("export")}
          >
            {t("tabExport")}
          </button>
          <button
            type="button"
            className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "import"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("import")}
          >
            {t("tabImport")}
          </button>
        </div>
        {tab === "import" && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium">{t("targetCategory")}</label>
            <Select value={targetCategory} onValueChange={setTargetCategory}>
              <SelectTrigger disabled={!preview}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="parsed">{t("keepSourceCategories")}</SelectItem>
                {categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
            {!preview && <p className="text-2xs text-muted-foreground">{t("chooseFileFirst")}</p>}
          </div>
        )}

        {tab === "export" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("exportHint", { count: bookmarks.length })}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 justify-start"
                disabled={bookmarks.length === 0}
                onClick={handleExportHtml}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t("exportHtml")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 justify-start"
                disabled={bookmarks.length === 0}
                onClick={handleExportJson}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {t("exportJson")}
              </Button>
            </div>
            <p className="text-2xs text-muted-foreground">{t("exportHtmlNote")}</p>
          </div>
        )}

        {tab === "import" && (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <p className="text-sm text-muted-foreground">{t("importHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".html,.htm,.json,text/html,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-9 w-full"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              {t("chooseFile")}
            </Button>

            {preview && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-medium" title={fileName}>
                    {fileName}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {t("previewCount", { count: preview.length })}
                    </span>
                  </p>
                  <span className="shrink-0 text-xs text-primary">
                    {t("selectedCount", { count: selectedIndexes.size })}
                  </span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setSelectedIndexes(new Set(preview.map((_, index) => index)))} disabled={busy}>
                    {t("selectAll")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedIndexes(new Set())} disabled={busy}>
                    {t("clearSelection")}
                  </Button>
                </div>
                <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden text-2xs text-muted-foreground">
                  {folderTree.map((node) => (
                    <FolderTreeItem
                      key={node.path}
                      node={node}
                      selectedIndexes={selectedIndexes}
                      disabled={busy}
                      onToggle={(indexes) => setSelectedIndexes((previous) => {
                        const next = new Set(previous);
                        const allSelected = indexes.every((index) => next.has(index));
                        indexes.forEach((index) => allSelected ? next.delete(index) : next.add(index));
                        return next;
                      })}
                    />
                  ))}
                </ul>
                {progress && (
                  <p className="mt-2 text-2xs text-primary">{progress}</p>
                )}
              </div>
            )}

            <DialogFooter className="shrink-0 gap-2 border-t border-border/50 bg-card/95 pt-3 sm:gap-0">
              <Button
                size="sm"
                variant="outline"
                onClick={resetImport}
                disabled={busy || !preview}
              >
                {t("clear")}
              </Button>
              <Button
                size="sm"
                disabled={busy || !preview || selectedIndexes.size === 0 || !writeToken}
                onClick={() => void runImport()}
              >
                {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                {t("importAction")}
              </Button>
            </DialogFooter>
            {!writeToken && (
              <p className="text-2xs text-amber-700 dark:text-amber-400">
                {t("tokenRequired")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
