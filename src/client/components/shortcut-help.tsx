import { Keyboard } from "lucide-react";
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
          <DialogTitle className="flex items-center gap-2 font-display">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <Keyboard className="h-4 w-4" />
            </span>
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <ul className="mt-1 max-h-[60vh] space-y-1 overflow-y-auto text-sm">
          {shortcuts.map((s) => (
            <li
              key={s.label + s.keys.join("+")}
              className="flex items-center justify-between gap-4 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60"
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
        <p className="mt-2 text-center text-2xs text-muted-foreground">
          <kbd>Esc</kbd> · <kbd>?</kbd>
        </p>
      </DialogContent>
    </Dialog>
  );
}
