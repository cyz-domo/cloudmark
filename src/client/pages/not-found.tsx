import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/client/i18n/context";

export function NotFoundPage() {
  const t = useTranslations("NotFoundPage");

  return (
    <div className="container flex flex-1 flex-col items-center justify-center py-24 text-center">
      <p className="mb-2 text-6xl font-bold text-muted-foreground/40">
        {t("errorCode")}
      </p>
      <h1 className="mb-2 text-xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-muted-foreground">{t("description")}</p>
      <Button asChild>
        <Link to="/">Home</Link>
      </Button>
    </div>
  );
}
