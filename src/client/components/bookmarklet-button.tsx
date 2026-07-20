import { useMemo } from "react";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildBookmarkletCode } from "@/shared/bookmarklet";
import { useTranslations } from "@/client/i18n/context";
import { BookmarkletLink } from "@/client/components/bookmarklet-link";

interface BookmarkletButtonProps {
  mark: string;
  baseUrl: string;
  writeToken: string | null;
  compact?: boolean;
}

export function BookmarkletButton({
  mark,
  baseUrl,
  writeToken,
  compact,
}: BookmarkletButtonProps) {
  const t = useTranslations("BookmarksPage");
  const code = useMemo(() => {
    if (!writeToken) return "";
    return buildBookmarkletCode(baseUrl, mark, writeToken);
  }, [baseUrl, mark, writeToken]);

  if (!writeToken) {
    return (
      <Button size="sm" variant="outline" className="h-8" disabled>
        <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
        {t("bookmarkletNeedsToken")}
      </Button>
    );
  }

  return (
    <BookmarkletLink
      code={code}
      className="inline-flex"
      title={t("bookmarkletTip")}
    >
      <Button size="sm" variant="outline" className="h-8 cursor-grab" asChild>
        <span>
          <BookmarkPlus className="mr-1.5 h-3.5 w-3.5" />
          {compact ? mark : t("saveButton", { mark })}
        </span>
      </Button>
    </BookmarkletLink>
  );
}
