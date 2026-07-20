import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "../../../messages/en.json";
import zh from "../../../messages/zh.json";

export type Locale = "en" | "zh";

const catalogs: Record<Locale, typeof en> = { en, zh };

type Messages = typeof en;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string, vars?: Record<string, string | number>) => string;
  messages: Messages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = "cloudmark:locale";

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "zh") return stored;
  } catch {
    // ignore
  }
  const nav = navigator.language.toLowerCase();
  return nav.startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  }, []);

  const messages = catalogs[locale];

  const t = useCallback(
    (path: string, vars?: Record<string, string | number>) => {
      const raw = getByPath(messages, path);
      let text = typeof raw === "string" ? raw : path;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return text;
    },
    [messages],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, messages }),
    [locale, setLocale, t, messages],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Compatibility helper similar to next-intl useTranslations namespace */
export function useTranslations(namespace?: string) {
  const { t } = useI18n();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      t(namespace ? `${namespace}.${key}` : key, vars),
    [t, namespace],
  );
}
