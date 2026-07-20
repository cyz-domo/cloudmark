import { Link } from "react-router";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n, useTranslations } from "@/client/i18n/context";

export function HomePage() {
  const t = useTranslations("HomePage");
  const { messages } = useI18n();
  const keys = Object.keys(messages.HomePage.features) as Array<
    keyof typeof messages.HomePage.features
  >;

  return (
    <div className="container relative py-8">
      <div className="fixed inset-0 -z-10">
        <div className="absolute right-0 top-0 h-[40rem] w-[40rem] translate-x-12 -translate-y-12 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[50rem] w-[50rem] -translate-x-12 translate-y-12 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center pb-8 pt-12 text-center lg:pt-20">
        <h1 className="mb-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 bg-clip-text text-4xl font-bold text-transparent">
          Cloudmark
        </h1>
        <h2 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
          {t("title")}
        </h2>
        <p className="mb-8 max-w-xl text-xl text-muted-foreground">
          {t("description")}
        </p>

        <div className="mb-8">
          <a
            href="https://github.com/wesleyel/cloudmark"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src="https://img.shields.io/github/stars/wesleyel/cloudmark?style=social"
              alt="GitHub stars"
              className="transition-transform hover:scale-105"
            />
          </a>
        </div>

        <div className="flex gap-4">
          <Button asChild size="lg" className="rounded-full px-8 text-base">
            <Link to="/doc" className="flex items-center gap-2">
              {t("quickstart")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full px-8 text-base"
          >
            <Link to="/demo" className="flex items-center gap-2">
              Demo
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {keys.map((key) => (
          <div
            key={key}
            className="relative rounded-xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <h3 className="mb-3 text-xl font-semibold">
              {t(`features.${key}.title`)}
            </h3>
            <p className="text-muted-foreground">
              {t(`features.${key}.desc`)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
