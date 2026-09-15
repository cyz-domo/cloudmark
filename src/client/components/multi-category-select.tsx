import { useState, useMemo, type KeyboardEvent } from "react";
import { Check, Plus, Tag, X, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/shared/utils";
import { useTranslations } from "@/client/i18n/context";

interface MultiCategorySelectProps {
  value: string[];
  onChange: (categories: string[]) => void;
  availableCategories: string[];
  placeholder?: string;
  disabled?: boolean;
}

export function MultiCategorySelect({
  value,
  onChange,
  availableCategories,
  placeholder,
  disabled,
}: MultiCategorySelectProps) {
  const t = useTranslations("Components.BookmarkDialog");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  // Clean value array (fallback to ['default'] if empty)
  const selectedList = value.length > 0 ? value : ["default"];

  // Merge available categories with any currently selected categories
  const allCategories = useMemo(() => {
    const set = new Set([...availableCategories, ...selectedList]);
    if (!set.has("default")) set.add("default");
    return Array.from(set);
  }, [availableCategories, selectedList]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allCategories;
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allCategories, search]);

  const toggleCategory = (cat: string) => {
    const isSelected = selectedList.includes(cat);
    let next: string[];
    if (isSelected) {
      next = selectedList.filter((c) => c !== cat);
      if (next.length === 0) {
        next = ["default"];
      }
    } else {
      // If adding something other than default when default is the only one, replace or keep?
      // Keeping all selected categories is more standard.
      next = [...selectedList.filter((c) => c !== "default" || cat === "default"), cat];
    }
    onChange(Array.from(new Set(next)));
  };

  const removeCategory = (cat: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let next = selectedList.filter((c) => c !== cat);
    if (next.length === 0) {
      next = ["default"];
    }
    onChange(next);
  };

  const handleCreateNewCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed || trimmed.length > 50) return;
    const next = Array.from(new Set([...selectedList.filter((c) => c !== "default"), trimmed]));
    onChange(next);
    setNewCategoryName("");
    setSearch("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateNewCategory();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-expanded={open}
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2.5 py-1 text-sm shadow-sm transition-colors",
            "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {selectedList.map((cat) => (
            <Badge
              key={cat}
              variant="secondary"
              className="inline-flex h-6 items-center gap-1 px-2 text-2xs font-normal"
            >
              <span className="max-w-[8rem] truncate">{cat}</span>
              {!disabled && (
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20 hover:text-foreground"
                  onClick={(e) => removeCategory(cat, e)}
                  title={t("delete")}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </Badge>
          ))}
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            <span className="text-2xs opacity-70">
              {placeholder || t("categoryPlaceholder")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <div className="space-y-2">
          <Input
            placeholder="搜索已有分类..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1 text-xs">
            {filteredCategories.map((cat) => {
              const isChecked = selectedList.includes(cat);
              return (
                <div
                  key={cat}
                  role="checkbox"
                  aria-checked={isChecked}
                  tabIndex={0}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 transition-colors",
                    isChecked
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted/60 text-foreground",
                  )}
                  onClick={() => toggleCategory(cat)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleCategory(cat);
                    }
                  }}
                >
                  <span className="truncate">{cat}</span>
                  {isChecked && <Check className="h-3.5 w-3.5 shrink-0" />}
                </div>
              );
            })}
            {filteredCategories.length === 0 && (
              <p className="py-2 text-center text-2xs text-muted-foreground">
                未找到匹配分类
              </p>
            )}
          </div>
          <div className="border-t border-border/60 pt-2">
            <div className="flex gap-1">
              <Input
                placeholder={t("newCategoryPlaceholder")}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={50}
                className="h-7 min-w-0 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2 text-xs"
                disabled={!newCategoryName.trim()}
                onClick={handleCreateNewCategory}
              >
                <Plus className="mr-0.5 h-3 w-3" />
                添加
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
