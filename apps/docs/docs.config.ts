import { defineConfig } from "docsivi";

export default defineConfig({
  site: {
    name: "docsivi",
    description: "A documentation site foundation you configure instead of maintain.",
    favicon: "/favicon.svg",
    github: { repo: "shiz-ceo/docsivi", branch: "main", contentDir: "apps/docs/content/docs" },
  },

  i18n: {
    defaultLanguage: "en",
    languages: ["en", "ru"],
    labels: { en: "English", ru: "Русский" },
  },

  versions: {
    list: [{ id: "v0", label: "v0 (latest)", status: "latest" }],
  },

  // This site has no API reference: there is no `openapi` block.

  blog: {
    description: {
      en: "How docsivi is built, what changes, and how to get the most of it.",
      ru: "Как устроен docsivi, что меняется и как выжать из него максимум.",
    },
    categories: [
      { id: "announcements", label: { en: "Announcements", ru: "Анонсы" } },
      { id: "engineering", label: { en: "Engineering", ru: "Инженерия" } },
      { id: "guides", label: { en: "Guides", ru: "Руководства" } },
    ],
    authors: {
      "shiz-ceo": { name: "Shiz-Ceo", role: "Creator", url: "https://github.com/shiz-ceo" },
    },
  },

  footer: {
    description: {
      en: "docsivi is a documentation site foundation built on Fumadocs, React Router and Vite.",
      ru: "docsivi это основа для сайта документации на Fumadocs, React Router и Vite.",
    },
    columns: [
      {
        title: { en: "Documentation", ru: "Документация" },
        links: [
          { title: { en: "Introduction", ru: "Введение" }, url: "/docs/v0" },
          { title: { en: "Quickstart", ru: "Быстрый старт" }, url: "/docs/v0/quickstart" },
          { title: { en: "Configuration", ru: "Настройка" }, url: "/docs/v0/configuration" },
          { title: { en: "Reference", ru: "Справочник" }, url: "/docs/v0/reference" },
        ],
      },
      {
        title: { en: "Project", ru: "Проект" },
        links: [
          { title: { en: "Blog", ru: "Блог" }, url: "/blog" },
          { title: "RSS", url: "/blog/rss.xml", external: true },
          { title: "GitHub", url: "https://github.com/shiz-ceo" },
        ],
      },
    ],
    social: [
      { type: "github", url: "https://github.com/shiz-ceo" },
      { type: "rss", url: "/en/blog/rss.xml" },
    ],
  },
});
