import { ExternalLink } from "lucide-react";
import { cn } from "@/shared/utils";
import { emojiFromIcon, isEmojiIcon } from "@/shared/favicon";

interface BookmarkIconProps {
  favicon?: string;
  title?: string;
  className?: string;
  imgClassName?: string;
}

/** Renders favicon URL, data URI, or emoji:… custom icon */
export function BookmarkIcon({
  favicon,
  title,
  className,
  imgClassName,
}: BookmarkIconProps) {
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

  if (favicon) {
    return (
      <img
        src={favicon}
        alt=""
        className={cn("h-4 w-4 object-contain", imgClassName)}
        loading="lazy"
        width={16}
        height={16}
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            "/placeholder.svg?height=16&width=16";
        }}
      />
    );
  }

  return (
    <ExternalLink
      className={cn("h-3 w-3 text-muted-foreground", className)}
    />
  );
}
