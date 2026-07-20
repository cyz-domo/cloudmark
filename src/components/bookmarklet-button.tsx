"use client";

import { BookmarkPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { buildBookmarkletCode } from "@/lib/bookmarklet";

interface BookmarkletButtonProps {
  mark: string;
  baseUrl: string;
  writeToken: string | null;
}

export function BookmarkletButton({
  mark,
  baseUrl,
  writeToken,
}: BookmarkletButtonProps) {
  const t = useTranslations("BookmarksPage");

  const bookmarkletCode = useMemo(() => {
    if (!writeToken) return "";
    return buildBookmarkletCode(baseUrl, mark, writeToken);
  }, [mark, baseUrl, writeToken]);

  if (!writeToken) {
    return (
      <div className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-dashed border-muted-foreground/30 text-muted-foreground h-9 px-4 py-2 opacity-70">
        <BookmarkPlus className="h-4 w-4 mr-2" />
        {t("bookmarkletNeedsToken")}
      </div>
    );
  }

  return (
    <div className="hover-scale">
      <a
        href="#"
        draggable={true}
        ref={(node) => {
          if (node) {
            node.setAttribute("href", bookmarkletCode);
          }
        }}
        onClick={(e) => e.preventDefault()}
        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 text-foreground h-9 px-4 py-2 select-all cursor-move shadow-sm hover:shadow-md"
        title={t("bookmarkletTip")}
      >
        <BookmarkPlus className="h-4 w-4 mr-2 text-blue-500" />
        {t("saveButton", { mark })}
      </a>
    </div>
  );
}
