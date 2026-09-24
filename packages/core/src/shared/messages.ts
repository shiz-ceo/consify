import type { DocsConfig } from "../config/index.ts";

/** UI strings owned by docsivi (Fumadocs translates its own widgets separately). */
export const messageKeys = [
  "documentation",
  "deprecatedVersion",
  "goToLatest",
  "editOnGithub",
  "notFound",
  "backToDocs",
  "blog",
  "allPosts",
  "searchPosts",
  "filter",
  "tags",
  "clearFilters",
  "noPosts",
  "minRead",
  "share",
  "relatedPosts",
  "backToBlog",
  "inThisArticle",
  "previous",
  "next",
  "page",
  "rss",
  "postedBy",
] as const;
export type MessageKey = (typeof messageKeys)[number];
export type Messages = Record<MessageKey, string>;

/** `{version}` and `{latest}` are replaced when the message is formatted. */
const builtin: Record<string, Messages> = {
  en: {
    documentation: "Documentation",
    deprecatedVersion:
      "You are viewing the documentation for {version}, which is no longer maintained.",
    goToLatest: "Go to {latest}",
    editOnGithub: "Edit this page on GitHub",
    notFound: "This page could not be found.",
    backToDocs: "Back to the documentation",
    blog: "Blog",
    allPosts: "All posts",
    searchPosts: "Search posts...",
    filter: "Filter",
    tags: "Tags",
    clearFilters: "Clear filters",
    noPosts: "No posts found.",
    minRead: "{minutes} min read",
    share: "Share",
    relatedPosts: "Keep reading",
    backToBlog: "Back to the blog",
    inThisArticle: "In this article",
    previous: "Previous",
    next: "Next",
    page: "Page {page}",
    rss: "RSS feed",
    postedBy: "By",
  },
  ru: {
    documentation: "Документация",
    deprecatedVersion: "Вы читаете документацию для {version}, она больше не поддерживается.",
    goToLatest: "Перейти к {latest}",
    editOnGithub: "Редактировать страницу на GitHub",
    notFound: "Такой страницы не существует.",
    backToDocs: "Вернуться к документации",
    blog: "Блог",
    allPosts: "Все статьи",
    searchPosts: "Поиск по статьям...",
    filter: "Фильтр",
    tags: "Теги",
    clearFilters: "Сбросить фильтры",
    noPosts: "Ничего не найдено.",
    minRead: "{minutes} мин чтения",
    share: "Поделиться",
    relatedPosts: "Читайте также",
    backToBlog: "Назад в блог",
    inThisArticle: "В этой статье",
    previous: "Назад",
    next: "Вперёд",
    page: "Страница {page}",
    rss: "RSS-лента",
    postedBy: "Автор",
  },
};

/** Built-in strings, then config overrides (`i18n.messages`); unknown languages fall back to English. */
export function getMessages(config: Readonly<DocsConfig>, lang: string): Messages {
  const base = builtin[lang] ?? (builtin.en as Messages);
  return { ...base, ...config.i18n.messages[lang] };
}

export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
