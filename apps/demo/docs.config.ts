import { defineConfig } from "consify";
import { externalLinks } from "./custom/plugins/external-links.ts";
import { githubAlerts } from "./custom/plugins/github-alerts.ts";

export default defineConfig({
  site: {
    name: "Lattice",
    description: "A typed job queue for TypeScript. Documentation demo built with consify.",
    url: "https://lattice.example.dev",
    favicon: "/favicon.svg",
    github: { repo: "example/lattice" },
  },

  i18n: {
    defaultLanguage: "en",
    languages: ["en", "ru"],
    labels: { en: "English", ru: "Русский" },
  },

  versions: {
    list: [
      { id: "v2", label: "v2 (latest)", status: "latest" },
      { id: "v1", label: "v1", status: "deprecated" },
    ],
  },

  // Type-check `twoslash` code blocks. `import "lattice"` resolves to the demo library in ./lattice
  // (linked in package.json), so hovers show real types.
  twoslash: {
    compilerOptions: {
      strict: true,
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      types: ["node"],
    },
  },

  plugins: [githubAlerts, externalLinks],

  // A separate API reference page (top navigation), generated from an OpenAPI schema
  openapi: { input: "./openapi.json", title: "API" },

  footer: {
    description: {
      en: "A typed job queue for TypeScript. Documentation demo built with consify.",
      ru: "Типизированная очередь задач для TypeScript. Демо документации на consify.",
    },
    columns: [
      {
        title: { en: "Product", ru: "Продукт" },
        links: [
          { title: { en: "Documentation", ru: "Документация" }, url: "/docs" },
          { title: "API", url: "/api" },
          { title: { en: "Blog", ru: "Блог" }, url: "/blog" },
        ],
      },
      {
        title: { en: "Resources", ru: "Ресурсы" },
        links: [
          { title: { en: "Quickstart", ru: "Быстрый старт" }, url: "/docs/v2/quickstart" },
          { title: { en: "Changelog", ru: "Изменения" }, url: "/docs/v2/changelog" },
          { title: "RSS", url: "/blog/rss.xml", external: true },
        ],
      },
      {
        title: { en: "Community", ru: "Сообщество" },
        links: [
          { title: "GitHub", url: "https://github.com/example/lattice" },
          { title: "Discord", url: "https://discord.gg/example" },
        ],
      },
    ],
    social: [
      { type: "github", url: "https://github.com/example/lattice" },
      { type: "x", url: "https://x.com/example" },
      { type: "discord", url: "https://discord.gg/example" },
      { type: "rss", url: "/en/blog/rss.xml" },
    ],
  },

  // The blog is a page of the top navigation. The short changelog stays in the docs.
  blog: {
    description: "Releases, engineering notes and stories from the Lattice team.",
    categories: [
      { id: "releases", label: { en: "Releases", ru: "Релизы" } },
      { id: "engineering", label: { en: "Engineering", ru: "Инженерия" } },
      { id: "customers", label: { en: "Customers", ru: "Клиенты" } },
      { id: "product", label: { en: "Product", ru: "Продукт" } },
    ],
    authors: {
      ada: { name: "Ada Novak", role: "Core maintainer", url: "https://github.com/example" },
      leo: { name: "Leo Brandt", role: "Developer relations" },
      mira: { name: "Mira Sato", role: "Product designer" },
    },
  },

  // Sections of the header where the search is hidden (the search covers the docs only)
  header: { hideSearchOn: ["blog"] },

  // The home page is content/home.mdx, the header is custom/header.tsx and the footer is
  // custom/footer.tsx: see the "Home, header and footer" page of the docs.
});
