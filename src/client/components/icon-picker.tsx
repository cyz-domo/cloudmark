import { useRef, useState } from "react";
import EmojiPicker, {
  type EmojiClickData,
  Theme,
  EmojiStyle,
} from "emoji-picker-react";
import {
  ImagePlus,
  Link as LinkIcon,
  RotateCcw,
  Smile,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/shared/utils";
import {
  COLOR_PRESETS,
  emojiFromIcon,
  emojiIcon,
  isEmojiIcon,
  isValidFaviconValue,
  makeMarkIcon,
  sanitizeSvg,
  siteFaviconUrl,
} from "@/shared/favicon";
import {
  FAVICON_MAX_LENGTH,
  FAVICON_UPLOAD_MAX_BYTES,
} from "@/shared/constants";
import { useTranslations, useI18n } from "@/client/i18n/context";
import { BookmarkIcon } from "@/client/components/bookmark-icon";

type Tab = "emoji" | "mark" | "upload" | "url";

interface IconPickerProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  pageUrl?: string;
  className?: string;
}

export function IconPicker({
  value,
  onChange,
  pageUrl,
  className,
}: IconPickerProps) {
  const t = useTranslations("Components.IconPicker");
  const { locale } = useI18n();
  const [tab, setTab] = useState<Tab>("emoji");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(
    value && !isEmojiIcon(value) && !value.startsWith("data:") ? value : "",
  );
  const [markLetter, setMarkLetter] = useState("A");
  const [markColor, setMarkColor] = useState<string>(COLOR_PRESETS[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  const autoUrl = pageUrl ? siteFaviconUrl(pageUrl) : "";

  const onEmojiClick = (data: EmojiClickData) => {
    onChange(emojiIcon(data.emoji));
    setEmojiOpen(false);
  };

  const applyUrl = () => {
    const v = urlInput.trim();
    if (!v) {
      onChange(undefined);
      return;
    }
    if (!isValidFaviconValue(v) || v.length > FAVICON_MAX_LENGTH) {
      toast.error(t("invalidUrl"));
      return;
    }
    onChange(v);
  };

  const onFile = async (file: File) => {
    if (file.size > FAVICON_UPLOAD_MAX_BYTES) {
      toast.error(
        t("fileTooLarge", {
          max: Math.floor(FAVICON_UPLOAD_MAX_BYTES / 1024),
        }),
      );
      return;
    }
    const type = file.type || guessMime(file.name);
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];
    if (
      type &&
      !allowed.includes(type) &&
      !file.name.match(/\.(ico|svg|png|jpe?g|gif|webp)$/i)
    ) {
      toast.error(t("invalidFileType"));
      return;
    }

    try {
      if (
        type === "image/svg+xml" ||
        file.name.toLowerCase().endsWith(".svg")
      ) {
        const text = await file.text();
        const clean = sanitizeSvg(text);
        const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(clean)))}`;
        if (dataUrl.length > FAVICON_MAX_LENGTH) {
          toast.error(
            t("fileTooLarge", {
              max: Math.floor(FAVICON_MAX_LENGTH / 1024),
            }),
          );
          return;
        }
        onChange(dataUrl);
        toast.success(t("uploaded"));
        return;
      }

      const dataUrl = await readAsDataUrl(file);
      if (dataUrl.length > FAVICON_MAX_LENGTH) {
        toast.error(
          t("fileTooLarge", {
            max: Math.floor(FAVICON_MAX_LENGTH / 1024),
          }),
        );
        return;
      }
      if (!isValidFaviconValue(dataUrl)) {
        toast.error(t("invalidFileType"));
        return;
      }
      onChange(dataUrl);
      toast.success(t("uploaded"));
    } catch {
      toast.error(t("uploadFailed"));
    }
  };

  const tabs = [
    ["emoji", t("tabEmoji")],
    ["mark", t("tabMark")],
    ["upload", t("tabUpload")],
    ["url", t("tabUrl")],
  ] as const;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/40">
          <BookmarkIcon
            favicon={value}
            title={markLetter}
            className="h-7 w-7 text-lg"
            imgClassName="h-7 w-7"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <ImagePlus className="h-3 w-3" />
            {t("label")}
          </Label>
          <p className="text-2xs text-muted-foreground leading-snug">
            {t("hint")}
          </p>
        </div>
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => onChange(undefined)}
          >
            <X className="mr-1 h-3 w-3" />
            {t("clear")}
          </Button>
        ) : null}
      </div>

      {autoUrl ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-left text-xs hover:bg-muted/50"
          onClick={() => onChange(autoUrl)}
        >
          <img src={autoUrl} alt="" className="h-5 w-5" />
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" />
            {t("useSiteIcon")}
          </span>
        </button>
      ) : null}

      <div className="flex gap-1 rounded-md border border-border/60 bg-muted/30 p-0.5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "flex-1 rounded px-1.5 py-1 text-2xs font-medium transition-colors",
              tab === id
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "emoji" && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 flex-1 justify-start"
            onClick={() => setEmojiOpen(true)}
          >
            <Smile className="mr-2 h-4 w-4" />
            {isEmojiIcon(value)
              ? t("currentEmoji", { emoji: emojiFromIcon(value!) })
              : t("openEmojiPicker")}
          </Button>

          {/* Nested dialog avoids Dialog→Popover pointer-events / scroll traps */}
          <Dialog open={emojiOpen} onOpenChange={setEmojiOpen}>
            <DialogContent
              hideOverlay
              hideClose
              className="w-fit max-w-[min(100vw-1.5rem,360px)] gap-0 overflow-hidden p-0 shadow-xl sm:rounded-xl"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DialogTitle className="sr-only">
                {t("openEmojiPicker")}
              </DialogTitle>
              <div
                className="emoji-picker-shell max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain"
                // Stop wheel from scrolling the parent dialog underneath
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  width="100%"
                  height={380}
                  theme={Theme.LIGHT}
                  emojiStyle={EmojiStyle.NATIVE}
                  lazyLoadEmojis
                  skinTonesDisabled
                  searchPlaceHolder={t("emojiSearch")}
                  previewConfig={{ showPreview: false }}
                  {...(locale === "zh" ? { lang: "zh" as const } : {})}
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {tab === "mark" && (
        <div className="space-y-2">
          <p className="text-2xs font-medium text-muted-foreground">
            {t("letterMark")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={markLetter}
              maxLength={2}
              onChange={(e) =>
                setMarkLetter(e.target.value.replace(/\s/g, "").slice(0, 2))
              }
              className="h-8 w-14 text-center text-sm uppercase"
            />
            <div className="flex flex-wrap gap-1">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    "h-6 w-6 rounded-full border-2 border-transparent",
                    markColor === c && "border-foreground/40",
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setMarkColor(c)}
                />
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() =>
                onChange(makeMarkIcon(markLetter || "?", markColor))
              }
            >
              {t("applyMark")}
            </Button>
          </div>
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept=".svg,.ico,.png,.jpg,.jpeg,.gif,.webp,image/svg+xml,image/png,image/jpeg,image/gif,image/webp,image/x-icon,image/vnd.microsoft.icon"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {t("chooseFile")}
          </Button>
          <p className="text-2xs text-muted-foreground">{t("uploadHint")}</p>
        </div>
      )}

      {tab === "url" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…/favicon.ico"
              className="h-8 font-mono text-2xs"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 shrink-0"
              onClick={applyUrl}
            >
              <LinkIcon className="mr-1 h-3.5 w-3.5" />
              {t("applyUrl")}
            </Button>
          </div>
          {autoUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-2xs"
              onClick={() => {
                setUrlInput(autoUrl);
                onChange(autoUrl);
              }}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {t("resetToSite")}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".svg")) return "image/svg+xml";
  if (n.endsWith(".ico")) return "image/x-icon";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".gif")) return "image/gif";
  if (n.endsWith(".webp")) return "image/webp";
  return "";
}
