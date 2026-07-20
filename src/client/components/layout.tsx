import { Link, Outlet } from "react-router";
import { FileText, Github } from "lucide-react";
import { useI18n, useTranslations } from "@/client/i18n/context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppLayout() {
  const t = useTranslations("Navigation");
  const { locale, setLocale } = useI18n();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(ellipse_at_top_right,rgba(147,51,234,0.12),transparent_70%),radial-gradient(ellipse_at_right,rgba(59,130,246,0.12),transparent_70%)]">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-12 items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/icon1.svg" alt="" className="h-5 w-5" width={20} height={20} />
            <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-sm font-bold text-transparent">
              Cloudmark
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              to="/doc"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t("quickstart")}</span>
            </Link>
            <a
              href="https://github.com/wesleyel/cloudmark"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
            >
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">{t("github")}</span>
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                  {locale === "zh" ? "中文" : "EN"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLocale("en")}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocale("zh")}>
                  中文
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-border/40">
        <div className="container flex flex-col gap-1 py-4 text-center">
          <p className="text-2xs text-muted-foreground">
            Released under the AGPL License.
          </p>
          <p className="text-2xs text-muted-foreground">
            Copyright © {new Date().getFullYear()}{" "}
            <a
              href="https://github.com/wesleyel"
              className="hover:text-primary"
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
