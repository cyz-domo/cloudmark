import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/client/lib/theme";
import { useTranslations } from "@/client/i18n/context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/utils";

const OPTIONS: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
  { value: "light", icon: Sun, labelKey: "light" },
  { value: "dark", icon: Moon, labelKey: "dark" },
  { value: "system", icon: Monitor, labelKey: "system" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolved, setTheme, cycleTheme } = useTheme();
  const t = useTranslations("Theme");

  const ActiveIcon = theme === "system" ? Monitor : resolved === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-8 w-8 rounded-full text-muted-foreground transition-colors hover:text-foreground",
            className,
          )}
          aria-label={t("toggle")}
          title={`${t("toggle")} (t)`}
          onKeyDown={(e) => {
            // Shift+T cycles when menu closed — handled globally too
            if (e.key === "t" && !e.metaKey && !e.ctrlKey && e.shiftKey) {
              e.preventDefault();
              cycleTheme();
            }
          }}
        >
          <ActiveIcon className="h-4 w-4 transition-transform duration-300" />
          <span className="sr-only">{t("toggle")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[9rem]">
        {OPTIONS.map(({ value, icon: Icon, labelKey }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "gap-2",
              theme === value && "bg-accent font-medium text-accent-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="flex-1">{t(labelKey)}</span>
            {theme === value ? (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
