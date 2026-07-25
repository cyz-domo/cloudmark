import { useEffect } from "react";
import { Link, Outlet } from "react-router";
import { FileText, Github, Languages } from "lucide-react";
import { useI18n, useTranslations } from "@/client/i18n/context";
import { useTheme } from "@/client/lib/theme";
import { ThemeToggle } from "@/client/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/shared/utils";

export function AppLayout() {
  const t = useTranslations("Navigation");
  const tt = useTranslations("Theme");
  const { locale, setLocale } = useI18n();
  const { cycleTheme } = useTheme();

  // Global keyboard: Shift+T cycles theme (when not typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key.toLowerCase() === "t" && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        cycleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleTheme]);

  return (
    <div className="app-canvas relative flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        {t("skipToContent")}
      </a>

      <header className="glass-header sticky top-0 z-50 w-full">
        <div className="container flex h-14 items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-2.5 rounded-lg outline-none ring-offset-background transition-opacity focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[hsl(230_90%_58%)] via-primary to-[hsl(var(--glow-2))] shadow-glow ring-1 ring-white/10">
              <img
                src="/icon1.svg"
                alt=""
                className="h-4 w-4 brightness-0 invert"
                width={16}
                height={16}
              />
            </span>
            <span className="font-display text-sm font-bold tracking-tight text-gradient-brand">
              Cloudmark
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-0.5 sm:gap-1" aria-label="Primary">
            <NavLink to="/doc" icon={FileText} label={t("quickstart")} />
            <a
              href="https://github.com/wesleyel/cloudmark"
              target="_blank"
              rel="noopener noreferrer"
              className={navClass}
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">{t("github")}</span>
            </a>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  aria-label={t("switchLanguage")}
                >
                  <Languages className="h-3.5 w-3.5" />
                  <span className="font-medium tabular-nums">
                    {locale === "zh" ? "中文" : "EN"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[8rem]">
                <DropdownMenuItem
                  onClick={() => setLocale("en")}
                  className={cn(locale === "en" && "bg-accent font-medium")}
                >
                  English
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocale("zh")}
                  className={cn(locale === "zh" && "bg-accent font-medium")}
                >
                  中文
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>

      <main id="main" className="flex flex-1 flex-col" tabIndex={-1}>
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-border/50">
        <div className="container flex flex-col items-center gap-2 py-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-2xs text-muted-foreground">
            Released under the AGPL License.
          </p>
          <p className="text-2xs text-muted-foreground">
            <span className="mr-2 hidden sm:inline" title={tt("cycleHint")}>
              <kbd>⇧T</kbd>
            </span>
            © {new Date().getFullYear()}{" "}
            <a
              href="https://github.com/wesleyel"
              className="font-medium text-foreground/80 underline-offset-4 transition-colors hover:text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Wesley Yang
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

const navClass =
  "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/70 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function NavLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof FileText;
  label: string;
}) {
  return (
    <Link to={to} className={navClass}>
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
