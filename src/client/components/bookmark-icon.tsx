import { useEffect, useMemo, useState } from "react";
import { cn } from "@/shared/utils";
import {
  COLOR_PRESETS,
  emojiFromIcon,
  isEmojiIcon,
} from "@/shared/favicon";

interface BookmarkIconProps {
  favicon?: string;
  title?: string;
  className?: string;
  imgClassName?: string;
}

/** Stable color from a seed so the same bookmark always gets the same mark. */
export function colorFromSeed(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % COLOR_PRESETS.length;
  return COLOR_PRESETS[idx]!;
}

/** First grapheme-ish char; works for CJK and Latin. */
export function letterFromTitle(title?: string): string {
  const t = (title ?? "").trim();
  if (!t) return "?";
  // Avoid splitting most BMP characters; good enough for favicon letters
  const ch = [...t][0] ?? "?";
  return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
}

function LetterMark({
  title,
  className,
  imgClassName,
}: {
  title?: string;
  className?: string;
  imgClassName?: string;
}) {
  const letter = useMemo(() => letterFromTitle(title), [title]);
  const bg = useMemo(
    () => colorFromSeed(title?.trim() || letter),
    [title, letter],
  );

  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] text-[10px] font-bold leading-none text-white",
        imgClassName,
        className,
      )}
      style={{ backgroundColor: bg }}
      aria-hidden
      title={title}
    >
      {letter}
    </span>
  );
}

/** Renders favicon URL, data URI, emoji:…, or letter+color fallback */
export function BookmarkIcon({
  favicon,
  title,
  className,
  imgClassName,
}: BookmarkIconProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [favicon]);

  if (favicon && isEmojiIcon(favicon)) {
    return (
      <span
        className={cn(
          "flex items-center justify-center leading-none",
          className,
        )}
        role="img"
        aria-label={title || "icon"}
      >
        {emojiFromIcon(favicon)}
      </span>
    );
  }

  if (favicon && !imgFailed) {
    return (
      <img
        src={favicon}
        alt=""
        className={cn("h-4 w-4 object-contain", imgClassName)}
        loading="lazy"
        width={16}
        height={16}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <LetterMark title={title} className={className} imgClassName={imgClassName} />
  );
}
