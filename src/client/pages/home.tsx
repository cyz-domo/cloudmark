import { Link } from "react-router";
import {
  ArrowRight,
  BookmarkPlus,
  FolderTree,
  Globe2,
  MousePointerClick,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, useTranslations } from "@/client/i18n/context";
import type { LucideIcon } from "lucide-react";

const FEATURE_ICONS: Record<string, LucideIcon> = {
  save: MousePointerClick,
  categorize: FolderTree,
  access: Globe2,
  private: Shield,
};

export function HomePage() {
  const t = useTranslations("HomePage");
  const { messages } = useI18n();
  const keys = Object.keys(messages.HomePage.features) as Array<
    keyof typeof messages.HomePage.features
  >;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="grid-fade absolute inset-0 opacity-50" />
        <div className="orb orb-a -right-24 -top-16 h-[28rem] w-[28rem] sm:h-[36rem] sm:w-[36rem]" />
        <div className="orb orb-b -bottom-24 -left-20 h-[26rem] w-[26rem] sm:h-[34rem] sm:w-[34rem]" />
      </div>

      <div className="container relative pb-16 pt-12 sm:pt-20 lg:pt-28">
        <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <p className="reveal mb-4 font-display text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">
            Cloudmark
          </p>

          <h1 className="reveal reveal-delay-1 display-font mb-5 max-w-2xl text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-gradient">{t("title")}</span>
          </h1>

          <p className="reveal reveal-delay-2 mb-10 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("description")}
          </p>

          <div className="reveal reveal-delay-3 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Button
              asChild
              size="lg"
              className="h-11 rounded-full px-7 text-sm font-semibold shadow-glow"
            >
              <Link to="/doc" className="flex items-center gap-2">
                <BookmarkPlus className="h-4 w-4" />
                {t("quickstart")}
                <ArrowRight className="h-4 w-4 opacity-80" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 rounded-full border-border/80 bg-card/40 px-7 text-sm font-semibold backdrop-blur-sm hover:bg-card/70"
            >
              <Link to="/demo">{t("demo")}</Link>
            </Button>
          </div>
        </section>

        <section
          className="reveal reveal-delay-4 mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-3 sm:mt-20 sm:grid-cols-2"
          aria-label={t("featuresLabel")}
        >
          {keys.map((key) => {
            const Icon = FEATURE_ICONS[key] ?? BookmarkPlus;
            return (
              <article
                key={key}
                className="feature-card surface-panel group rounded-2xl p-5"
              >
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <h2 className="mb-1.5 font-display text-base font-semibold tracking-tight">
                  {t(`features.${key}.title`)}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`features.${key}.desc`)}
                </p>
              </article>
            );
          })}
        </section>

        <section className="mx-auto mt-14 max-w-4xl sm:mt-16">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border/70 bg-card/50 p-5 shadow-sm sm:flex-row sm:items-center sm:p-6">
            <div className="max-w-md">
              <h2 className="font-display text-lg font-semibold tracking-tight">
                {t("cta.title")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("cta.description")}
              </p>
            </div>
            <Button asChild className="h-10 shrink-0 rounded-full px-5">
              <Link to="/doc" className="flex items-center gap-2">
                {t("cta.button")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
