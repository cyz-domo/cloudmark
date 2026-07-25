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
import type { CollectionSettings } from "@/shared/types";
import { DEFAULT_COLLECTION_SETTINGS } from "@/shared/types";
import { updateCollectionSettingsApi } from "@/client/lib/api";
import { useTranslations } from "@/client/i18n/context";
import { CollectionSettingsFields } from "@/client/components/collection-settings-fields";

interface CollectionSettingsDialogProps {
  mark: string;
  writeToken: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CollectionSettings;
  onSaved: (settings: CollectionSettings) => void;
}

export function CollectionSettingsDialog({
  mark,
  writeToken,
  open,
  onOpenChange,
  settings,
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
          disabled={saving || !writeToken}
        />

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
