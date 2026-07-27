import { Eye, EyeOff, FolderOpen, Image, Undo2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/shared/utils";
import type { CollectionSettings, SortProfile } from "@/shared/types";
import { useTranslations } from "@/client/i18n/context";

interface CollectionSettingsFieldsProps {
  value: CollectionSettings;
  onChange: (next: CollectionSettings) => void;
  disabled?: boolean;
  categories: string[];
  sortProfiles: SortProfile[];
  className?: string;
}

export function CollectionSettingsFields({
  value,
  onChange,
  disabled,
  categories,
  sortProfiles,
  className,
}: CollectionSettingsFieldsProps) {
  const t = useTranslations("CollectionSettings");
  const selectableCategories = [...new Set(["default", ...categories])];
  const customDefault = !selectableCategories.includes(value.defaultCategory);

  const set = <K extends keyof CollectionSettings>(
    key: K,
    v: CollectionSettings[K],
  ) => onChange({ ...value, [key]: v });

  return (
    <div className={cn("space-y-3", className)}>
      <ToggleRow
        icon={Undo2}
        label={t("redirectAfterSave")}
        description={t("redirectAfterSaveHint")}
        checked={value.redirectAfterSave}
        disabled={disabled}
        onCheckedChange={(v) => set("redirectAfterSave", v)}
      />
      <ToggleRow
        icon={value.isPublic ? Eye : EyeOff}
        label={t("isPublic")}
        description={t("isPublicHint")}
        checked={value.isPublic}
        disabled={disabled}
        onCheckedChange={(v) => set("isPublic", v)}
      />
      <div className="rounded-xl border border-border/70 bg-card/40 p-3">
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          <FolderOpen className="h-3.5 w-3.5 text-primary" />
          {t("defaultCategory")}
        </label>
        <Select
          value={customDefault ? "__custom__" : value.defaultCategory}
          onValueChange={(next) => {
            if (next === "__custom__") {
              set("defaultCategory", customDefault ? value.defaultCategory : "");
            } else {
              set("defaultCategory", next);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {selectableCategories.map((category) => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
            <SelectItem value="__custom__">{t("customCategory")}</SelectItem>
          </SelectContent>
        </Select>
        {(customDefault || value.defaultCategory === "") && (
          <Input
            value={value.defaultCategory}
            disabled={disabled}
            onChange={(e) => set("defaultCategory", e.target.value.replace(/^\s+/, "").slice(0, 50))}
            placeholder="default"
            className="mt-2 h-9"
          />
        )}
        <p className="mt-1.5 text-2xs text-muted-foreground">
          {t("defaultCategoryHint")}
        </p>
      </div>
      <div className="rounded-xl border border-border/70 bg-card/40 p-3">
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          <FolderOpen className="h-3.5 w-3.5 text-primary" />
          {t("homeCategory")}
        </label>
        <Select value={value.homeCategory || "__all__"} onValueChange={(next) => set("homeCategory", next === "__all__" ? "" : next)} disabled={disabled}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allCategories")}</SelectItem>
            {selectableCategories.map((category) => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-2xs text-muted-foreground">{t("homeCategoryHint")}</p>
        <label className="mb-1.5 mt-3 flex items-center gap-2 text-sm font-medium">{t("homeSortProfile")}</label>
        <Select value={value.homeSortProfile || "__default__"} onValueChange={(next) => set("homeSortProfile", next === "__default__" ? "" : next)} disabled={disabled}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">{t("defaultSort")}</SelectItem>
            {sortProfiles.map((profile) => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-2xs text-muted-foreground">{t("homeSortProfileHint")}</p>
      </div>
      <div className="rounded-xl border border-border/70 bg-card/40 p-3">
        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          <Image className="h-3.5 w-3.5 text-primary" />
          {t("backgroundUrl")}
        </label>
        <Input
          value={value.backgroundUrl}
          disabled={disabled}
          onChange={(e) => set("backgroundUrl", e.target.value.slice(0, 5 * 1024 * 1024))}
          placeholder="https://example.com/background.jpg"
          className="h-9"
          type="url"
        />
        <p className="mt-1.5 text-2xs text-muted-foreground">{t("backgroundUrlHint")}</p>
      </div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  icon: typeof Eye;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border border-border/70 bg-card/40 p-3 text-left transition-colors",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-60",
        checked && "border-primary/30 bg-primary/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          checked
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-2xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "relative mt-1 h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "left-4" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
