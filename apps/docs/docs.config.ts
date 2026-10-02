import { blog } from "@consify/blog";
import { defineConfig } from "@consify/core";
import { docs } from "@consify/docs";

export default defineConfig({
  site: {
    name: "Consify",
    description: "A documentation site foundation you configure instead of maintain.",
    url: "https://consify.shiz-ceo.ru",
    favicon: "/favicon.svg",
    github: { repo: "shiz-ceo/consify", branch: "main" },
  },

  // Plain static files, deployed to GitHub Pages under its own custom domain (no basePath needed).
  deploy: { mode: "static" },

  i18n: {
    defaultLanguage: "en",
    languages: ["en", "ru"],
    labels: { en: "English", ru: "Русский" },
  },

  features: [
    docs({
      versions: { list: [{ id: "v0", label: "v0 (latest)", status: "latest" }] },
      // English ids of the headings, the same in both languages, and the registry of them (anchors.json)
      anchors: true,
      // code shared by the pages of both languages: snippets/v0/, <Snippet id="…" /> on a page
      snippets: true,
      // the language folders of the docs of consify live in this folder of the repository
      editOnGithub: { contentDir: "apps/docs/content" },
    }),
    blog({
      description: {
        en: "How Consify is built, what changes, and how to get the most of it.",
        ru: "Как устроен Consify, что меняется и как выжать из него максимум.",
      },
      categories: [
        { id: "announcements", label: { en: "Announcements", ru: "Анонсы" } },
        { id: "engineering", label: { en: "Engineering", ru: "Инженерия" } },
        { id: "guides", label: { en: "Guides", ru: "Руководства" } },
      ],
      authors: {
        "shiz-ceo": { name: "Shiz-Ceo", role: "Creator", url: "https://github.com/shiz-ceo" },
      },
    }),
  ],

  footer: {
    description: {
      en: "Consify is a documentation site foundation built on Fumadocs, React Router and Vite.",
      ru: "Consify — это основа для сайта документации на Fumadocs, React Router и Vite.",
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
