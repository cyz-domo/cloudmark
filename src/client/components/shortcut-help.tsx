import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslations } from "@/client/i18n/context";

export interface ShortcutItem {
  keys: string[];
  label: string;
}

interface ShortcutHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: ShortcutItem[];
}

export function ShortcutHelp({
  open,
  onOpenChange,
  shortcuts,
}: ShortcutHelpProps) {
  const t = useTranslations("Shortcuts");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <ul className="mt-2 max-h-[60vh] space-y-1.5 overflow-y-auto text-sm">
          {shortcuts.map((s) => (
            <li
              key={s.label + s.keys.join("+")}
              className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted/60"
            >
              <span className="text-muted-foreground">{s.label}</span>
              <span className="flex shrink-0 items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
