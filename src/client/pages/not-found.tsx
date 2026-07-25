import { Link } from "react-router";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/client/i18n/context";

export function NotFoundPage() {
  const t = useTranslations("NotFoundPage");

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-24 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="grid-fade absolute inset-0 opacity-40" />
        <div className="orb orb-a right-1/4 top-1/4 h-64 w-64 opacity-60" />
      </div>

      <div className="reveal mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/70 bg-card/60 text-primary shadow-elevated backdrop-blur-md">
        <Compass className="h-6 w-6" strokeWidth={1.75} />
      </div>

      <p className="reveal reveal-delay-1 display-font mb-2 text-[clamp(4.5rem,18vw,9rem)] font-bold leading-none tracking-tighter text-gradient opacity-90">
        {t("errorCode")}
      </p>
      <h1 className="reveal reveal-delay-2 mb-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">
        {t("title")}
      </h1>
      <p className="reveal reveal-delay-3 mb-8 max-w-sm text-sm text-muted-foreground">
        {t("description")}
      </p>
      <div className="reveal reveal-delay-4">
        <Button asChild className="h-11 rounded-full px-6 shadow-glow">
          <Link to="/" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t("home")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
