"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Bookmark,
  Code,
  ExternalLink,
  Check,
  Copy,
  Book,
  CheckCircle,
  BookOpen,
  Wand2,
  RefreshCcw,
  HashIcon,
  ChevronRight,
  KeyRound,
  Shield,
} from "lucide-react";
import "./page.css";
import { generateRandomMark, getBaseUrl } from "@/lib/utils";
import { generateWriteToken } from "@/lib/security";
import { buildBookmarkletCode } from "@/lib/bookmarklet";
import { setStoredWriteToken } from "@/lib/token-store";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";

export default function DocPage() {
  const t = useTranslations("DocPage");
  const [mark, setMark] = useState("");
  const [writeToken, setWriteToken] = useState("");
  const [copied, setCopied] = useState<"code" | "token" | "url" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const baseUrl = getBaseUrl();

  const bookmarkletCode = useMemo(() => {
    if (!mark || !writeToken) return "";
    return buildBookmarkletCode(baseUrl, mark, writeToken);
  }, [baseUrl, mark, writeToken]);

  // Persist token when mark/token change
  useEffect(() => {
    if (mark && writeToken) {
      setStoredWriteToken(mark, writeToken);
    }
  }, [mark, writeToken]);

  // Initialize random mark + write token
  useEffect(() => {
    setMark(generateRandomMark());
    setWriteToken(generateWriteToken());
  }, []);

  const handleCopy = (kind: "code" | "token" | "url") => {
    const text =
      kind === "code"
        ? bookmarkletCode
        : kind === "token"
          ? writeToken
          : `${baseUrl}/${mark}`;
    navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerateRandom = () => {
    setIsGenerating(true);
    const nextMark = generateRandomMark();
    const nextToken = generateWriteToken();
    setMark(nextMark);
    setWriteToken(nextToken);
    setStoredWriteToken(nextMark, nextToken);
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handleMarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanedValue = e.target.value.replace(/[^a-zA-Z0-9_-]/g, "");
    setMark(cleanedValue);
  };

  const handleRegenerateToken = () => {
    const next = generateWriteToken();
    setWriteToken(next);
    if (mark) {
      setStoredWriteToken(mark, next);
    }
  };

  if (!mark) {
    return (
      <div className="container flex items-center justify-center min-h-screen">
        <div className="fade-in text-center">
          <p className="text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* 装饰背景元素 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-blue-500/10 rounded-full blur-3xl transform -translate-y-12 translate-x-12" />
        <div className="absolute bottom-0 left-0 w-[50rem] h-[50rem] bg-purple-500/10 rounded-full blur-3xl transform translate-y-12 -translate-x-12" />
        <div className="absolute bottom-1/3 right-1/4 w-[30rem] h-[30rem] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      {/* 右侧悬浮导航 */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-10 hidden md:block">
        <div className="flex flex-col gap-3 p-3 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-lg border border-white/20 dark:border-white/5">
          <a
            href="#intro"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-all duration-200 px-4 py-3 rounded-xl hover:bg-blue-50/80 dark:hover:bg-blue-950/30 group relative"
          >
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500/0 rounded-r-full group-hover:bg-blue-500 transition-all duration-200"></span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-all duration-200 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40">
              <BookOpen className="h-4 w-4" />
            </div>
            <span>{t("navigation.intro")}</span>
          </a>

          <a
            href="#setup"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition-all duration-200 px-4 py-3 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-indigo-950/30 group relative"
          >
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500/0 rounded-r-full group-hover:bg-indigo-500 transition-all duration-200"></span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 transition-all duration-200 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40">
              <Code className="h-4 w-4" />
            </div>
            <span>{t("navigation.setup")}</span>
          </a>

          <a
            href="#usage"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 transition-all duration-200 px-4 py-3 rounded-xl hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 group relative"
          >
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500/0 rounded-r-full group-hover:bg-emerald-500 transition-all duration-200"></span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 transition-all duration-200 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40">
              <Book className="h-4 w-4" />
            </div>
            <span>{t("navigation.usage")}</span>
          </a>

          <a
            href="#demo"
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-purple-600 dark:text-slate-300 dark:hover:text-purple-400 transition-all duration-200 px-4 py-3 rounded-xl hover:bg-purple-50/80 dark:hover:bg-purple-950/30 group relative"
          >
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-purple-500/0 rounded-r-full group-hover:bg-purple-500 transition-all duration-200"></span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 transition-all duration-200 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40">
              <ExternalLink className="h-4 w-4" />
            </div>
            <span>{t("navigation.demo")}</span>
          </a>
        </div>
      </div>

      {/* 移动设备浮动导航 */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 md:hidden">
        <div className="flex gap-2 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-full shadow-lg border border-white/20 dark:border-white/5">
          <a
            href="#intro"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all duration-200"
            aria-label={t("navigation.intro")}
          >
            <BookOpen className="h-5 w-5" />
          </a>

          <a
            href="#setup"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100/50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all duration-200"
            aria-label={t("navigation.setup")}
          >
            <Code className="h-5 w-5" />
          </a>

          <a
            href="#usage"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all duration-200"
            aria-label={t("navigation.usage")}
          >
            <Book className="h-5 w-5" />
          </a>

          <a
            href="#demo"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100/50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-all duration-200"
            aria-label={t("navigation.demo")}
          >
            <ExternalLink className="h-5 w-5" />
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 my-20">
        <div className="mb-12 text-center fade-in-up">
          <div className="inline-flex items-center justify-center mb-4 p-2 rounded-full bg-primary/10">
            <Bookmark className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 mb-3">
            {t("title")}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t("description")}
          </p>
        </div>

        <div className="space-y-16 mt-16">
          {/* 简介部分 */}
          <section
            id="intro"
            className="rounded-2xl bg-gradient-to-br from-blue-50/40 via-white/80 to-purple-50/40 dark:from-blue-950/20 dark:via-slate-900/30 dark:to-purple-950/20 shadow-md py-8 px-6 md:px-10 backdrop-blur-sm border border-white/20 dark:border-white/5 fade-in-up delay-1"
          >
            <div className="prose prose-slate dark:prose-invert mx-auto max-w-none">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center p-2 rounded-lg bg-blue-500/10">
                  <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h2
                  className="flex items-center gap-2 text-2xl font-bold m-0 scroll-mt-20"
                  id="intro-title"
                >
                  {t("intro.title")}
                  <a
                    href="#intro"
                    className="opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <HashIcon className="h-4 w-4 text-muted-foreground" />
                  </a>
                </h2>
              </div>
              <p>{t("intro.description")}</p>
              <div className="bg-white/50 dark:bg-slate-900/50 border border-blue-100 dark:border-blue-900/30 rounded-lg p-6 my-6">
                <h3 className="text-lg font-medium mb-2 flex items-center text-blue-700 dark:text-blue-400">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {t("intro.features.title")}
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t("intro.features.oneClick")}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t("intro.features.cloud")}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t("intro.features.categories")}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t("intro.features.custom")}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t("intro.features.sorting")}</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>{t("intro.features.multilingual")}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 使用 Bookmarklet 部分 */}
          <section
            id="setup"
            className="rounded-2xl bg-gradient-to-br from-indigo-50/40 via-white/80 to-purple-50/40 dark:from-indigo-950/20 dark:via-slate-900/30 dark:to-purple-950/20 shadow-md py-8 px-6 md:px-10 backdrop-blur-sm border border-white/20 dark:border-white/5 fade-in-up delay-2 scroll-mt-16"
          >
            <div className="prose prose-slate dark:prose-invert mx-auto max-w-none">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center p-2 rounded-lg bg-indigo-500/10">
                  <Code className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="flex items-center gap-2 text-2xl font-bold m-0">
                  {t("setup.title")}
                  <a
                    href="#setup"
                    className="opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <HashIcon className="h-4 w-4 text-muted-foreground" />
                  </a>
                </h2>
              </div>

              {/* 书签集合名称输入 */}
              <div className="my-8 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center">
                    <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 mr-2 text-sm">
                      1
                    </span>
                    {t("setup.markName.title")}
                  </h3>
                  <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-5 border border-indigo-100 dark:border-indigo-900/30">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Input
                          id="mark-input"
                          placeholder={t("setup.markName.placeholder")}
                          value={mark}
                          onChange={handleMarkChange}
                          className="flex-1 border-indigo-500/20 focus:border-indigo-500/40 bg-white dark:bg-slate-800 focus:ring-indigo-500/10"
                        />
                        <div className="hover-scale">
                          <Button
                            variant="outline"
                            onClick={handleGenerateRandom}
                            disabled={isGenerating}
                            className="border-indigo-500/20 hover:border-indigo-500/40 bg-white dark:bg-slate-800 hover:bg-indigo-500/10 transition-all duration-200"
                          >
                            {isGenerating ? (
                              <RefreshCcw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Wand2 className="h-4 w-4 mr-1" />
                            )}
                            {t("setup.markName.button")}
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {t("setup.markName.description")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Write token */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center">
                    <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 mr-2 text-sm">
                      2
                    </span>
                    {t("setup.writeToken.title")}
                  </h3>
                  <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-5 border border-amber-100 dark:border-amber-900/30">
                    <div className="flex items-start gap-2 mb-3 text-amber-700 dark:text-amber-300 text-sm">
                      <Shield className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>{t("setup.writeToken.description")}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <code className="flex-1 truncate rounded-md border border-amber-500/20 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-mono flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                        {writeToken || "…"}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-amber-500/30"
                        onClick={() => handleCopy("token")}
                      >
                        {copied === "token" ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        <span className="ml-1.5">{t("setup.writeToken.copy")}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-amber-500/30"
                        onClick={handleRegenerateToken}
                      >
                        <RefreshCcw className="h-4 w-4 mr-1" />
                        {t("setup.writeToken.regenerate")}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("setup.writeToken.hint")}
                    </p>
                  </div>
                </div>

                {/* 书签按钮部分 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center">
                    <span className="w-6 h-6 inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 mr-2 text-sm">
                      3
                    </span>
                    {t("setup.bookmarklet.title")}
                  </h3>
                  <div className="bg-white/50 dark:bg-slate-900/50 rounded-lg p-5 border border-indigo-100 dark:border-indigo-900/30">
                    <div className="flex flex-col sm:flex-row gap-3">
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
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 h-10 px-5 py-2 select-all cursor-move shadow-md hover:shadow-lg transition-all duration-200"
                        >
                          <Bookmark className="mr-2 h-4 w-4" />
                          {t("setup.bookmarklet.saveButton", { mark })}
                        </a>
                      </div>

                      <div className="hover-scale">
                        <a
                          href={`${baseUrl}/${mark}`}
                          draggable={true}
                          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-5 py-2 select-all cursor-move shadow-sm hover:shadow-md transition-all duration-200"
                          suppressHydrationWarning
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t("setup.bookmarklet.openButton", { mark })}
                        </a>
                      </div>

                      <div className="hidden sm:flex items-center ml-2 text-sm text-muted-foreground">
                        <span className="animate-pulse">←</span>
                        <span className="ml-2">
                          {t("setup.bookmarklet.dragTip")}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-4">
                      {t("setup.bookmarklet.description")}
                    </p>
                  </div>
                </div>

                {/* 代码显示部分 */}
                <details className="group bg-white/50 dark:bg-slate-900/50 rounded-lg p-2 border border-indigo-100 dark:border-indigo-900/30">
                  <summary className="flex items-center cursor-pointer p-3 rounded-md bg-indigo-50 dark:bg-indigo-900/20 transition-all duration-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300">
                    <Wand2 className="h-5 w-5 mr-2 transition-transform duration-300 group-open:rotate-90" />
                    <span className="font-medium">{t("setup.code.title")}</span>
                  </summary>
                  <div className="mt-3 content p-3">
                    <div className="relative">
                      <div className="max-h-[200px] overflow-y-auto">
                        <pre className="p-4 bg-slate-50 dark:bg-slate-800 backdrop-blur-sm rounded-lg text-sm whitespace-pre-wrap break-all border border-slate-200 dark:border-slate-700 transition-all duration-300 hover:shadow-md">
                          <code>{bookmarkletCode}</code>
                        </pre>
                      </div>
                      <div className="absolute right-2 top-2 hover-scale">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-900 transition-all duration-200"
                          onClick={() => handleCopy("code")}
                        >
                          {copied === "code" ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </section>

          {/* 使用说明部分 */}
          <section
            id="usage"
            className="rounded-2xl bg-gradient-to-br from-emerald-50/40 via-white/80 to-sky-50/40 dark:from-emerald-950/20 dark:via-slate-900/30 dark:to-sky-950/20 shadow-md py-8 px-6 md:px-10 backdrop-blur-sm border border-white/20 dark:border-white/5 fade-in-up delay-3 scroll-mt-16"
          >
            <div className="prose prose-slate dark:prose-invert mx-auto max-w-none">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center p-2 rounded-lg bg-emerald-500/10">
                  <Book className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="flex items-center gap-2 text-2xl font-bold m-0">
                  {t("usage.title")}
                  <a
                    href="#usage"
                    className="opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <HashIcon className="h-4 w-4 text-muted-foreground" />
                  </a>
                </h2>
              </div>

              <div className="space-y-6 my-6">
                <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-5 border border-emerald-100 dark:border-emerald-900/30 hover:shadow-md transition-all duration-300 fade-in-up delay-1">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold">
                      1
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mt-0 mb-2 text-emerald-700 dark:text-emerald-400">
                        {t("usage.steps.setup.title")}
                      </h3>
                      <p className="mb-0 text-slate-600 dark:text-slate-300">
                        {t("usage.steps.setup.description")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-5 border border-emerald-100 dark:border-emerald-900/30 hover:shadow-md transition-all duration-300 fade-in-up delay-2">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold">
                      2
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mt-0 mb-2 text-emerald-700 dark:text-emerald-400">
                        {t("usage.steps.save.title")}
                      </h3>
                      <p className="mb-0 text-slate-600 dark:text-slate-300">
                        {t("usage.steps.save.description")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-5 border border-emerald-100 dark:border-emerald-900/30 hover:shadow-md transition-all duration-300 fade-in-up delay-3">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold">
                      3
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mt-0 mb-2 text-emerald-700 dark:text-emerald-400">
                        {t("usage.steps.access.title")}
                      </h3>
                      <p className="mb-0 text-slate-600 dark:text-slate-300">
                        {t.rich("usage.steps.access.description", {
                          baseUrl,
                          mark,
                          code: (chunks) => (
                            <code className="bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300 text-sm">
                              {chunks}
                            </code>
                          ),
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-5 border border-emerald-100 dark:border-emerald-900/30 hover:shadow-md transition-all duration-300 fade-in-up delay-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-semibold">
                      4
                    </div>
                    <div>
                      <h3 className="text-lg font-medium mt-0 mb-2 text-emerald-700 dark:text-emerald-400">
                        {t("usage.steps.manage.title")}
                      </h3>
                      <p className="mb-0 text-slate-600 dark:text-slate-300">
                        {t("usage.steps.manage.description")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 演示按钮 */}
          <section
            id="demo"
            className="rounded-2xl bg-gradient-to-br from-purple-50/40 via-white/80 to-pink-50/40 dark:from-purple-950/20 dark:via-slate-900/30 dark:to-pink-950/20 shadow-md py-8 px-6 md:px-10 backdrop-blur-sm border border-white/20 dark:border-white/5 text-center fade-in-up delay-4 scroll-mt-16"
          >
            <div className="max-w-xl mx-auto">
              <div className="flex items-center justify-center mb-4">
                <div className="flex items-center justify-center p-2 rounded-lg bg-purple-500/10">
                  <ExternalLink className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
                {t("demo.title")}
                <a
                  href="#demo"
                  className="opacity-0 hover:opacity-100 transition-opacity"
                >
                  <HashIcon className="h-4 w-4 text-muted-foreground" />
                </a>
              </h2>
              <p className="text-muted-foreground mb-6">
                {t("demo.description")}
              </p>
              <Link href="/demo" className="inline-block hover-scale">
                <Button
                  size="lg"
                  className="gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all duration-200"
                >
                  {t("demo.button")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
