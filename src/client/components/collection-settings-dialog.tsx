import { useEffect, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CollectionSettings, SortProfile } from "@/shared/types";
import { DEFAULT_COLLECTION_SETTINGS } from "@/shared/types";
import { createSortProfileApi, deleteSortProfileApi, renameSortProfileApi, updateCollectionSettingsApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";
import { CollectionSettingsFields } from "@/client/components/collection-settings-fields";

interface CollectionSettingsDialogProps {
  mark: string;
  writeToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CollectionSettings;
  categories: string[];
  sortProfiles: SortProfile[];
  onProfilesChange: (profiles: SortProfile[]) => void;
  onSaved: (settings: CollectionSettings) => void;
}

export function CollectionSettingsDialog({
  mark,
  writeToken,
  open,
  onOpenChange,
  settings,
  categories,
  sortProfiles,
  onProfilesChange,
  onSaved,
}: CollectionSettingsDialogProps) {
  const t = useTranslations("CollectionSettings");
  const [draft, setDraft] = useState<CollectionSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(settings ?? DEFAULT_COLLECTION_SETTINGS);
  }, [open, settings]);

  const save = async () => {
    if (!writeToken) {
      toast.error(t("tokenRequired"));
      return;
    }
    setSaving(true);
    try {
      const next = await updateCollectionSettingsApi({
        mark,
        token: writeToken,
        ...draft,
        defaultCategory: draft.defaultCategory.trim() || "default",
        backgroundUrl: draft.backgroundUrl.trim(),
        homeCategory: draft.homeCategory.trim(),
      });
      onSaved(next);
      toast.success(t("saved"));
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const manageProfile = async (action: "create" | "rename" | "delete") => {
    if (!writeToken) return;
    const current = sortProfiles.find((profile) => profile.id === draft.homeSortProfile);
    const name = window.prompt(action === "delete" ? `删除排序方案“${current?.name ?? ""}”？输入确认名称` : action === "create" ? "新排序方案名称" : "重命名排序方案", action === "delete" ? "" : current?.name ?? "")?.trim();
    if (!name || (action === "delete" && name !== current?.name)) return;
    try {
      if (action === "create") {
        const profile = await createSortProfileApi({ mark, token: writeToken, id: crypto.randomUUID(), name });
        onProfilesChange([...sortProfiles, profile]);
        setDraft((previous) => ({ ...previous, homeSortProfile: profile.id }));
      } else if (current && action === "rename") {
        await renameSortProfileApi({ mark, token: writeToken, id: current.id, name });
        onProfilesChange(sortProfiles.map((profile) => profile.id === current.id ? { ...profile, name } : profile));
      } else if (current) {
        await deleteSortProfileApi({ mark, token: writeToken, id: current.id });
        onProfilesChange(sortProfiles.filter((profile) => profile.id !== current.id));
        const nextDraft = { ...draft, homeSortProfile: "" };
        setDraft(nextDraft);
        onSaved(nextDraft);
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : t("saveFailed")); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <Settings2 className="h-4 w-4" />
            </span>
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description", { mark })}</DialogDescription>
        </DialogHeader>

        <CollectionSettingsFields
          value={draft}
          onChange={setDraft}
          categories={categories}
          sortProfiles={sortProfiles}
          disabled={saving || !writeToken}
        />
        <div className="mt-2 flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void manageProfile("create")} disabled={saving || !writeToken}>{t("createSortProfile")}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void manageProfile("rename")} disabled={saving || !writeToken || !draft.homeSortProfile}>{t("renameSortProfile")}</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void manageProfile("delete")} disabled={saving || !writeToken || !draft.homeSortProfile}>{t("deleteSortProfile")}</Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || !writeToken}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {t("saving")}
              </>
            ) : (
              t("save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
