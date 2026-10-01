import { apiReference } from "@consify/api-reference";
import { blog } from "@consify/blog";
import { defineConfig } from "@consify/core";
import { docs } from "@consify/docs";
import { examples } from "./custom/features/examples.tsx";
import { status } from "./custom/features/status.tsx";
import HeaderEnd from "./custom/header-end.tsx";
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

  // Tags for the <head> of every page: meta, links and scripts (analytics goes here)
  head: {
    meta: [{ name: "theme-color", content: "#0f0f0f" }],
    links: [{ rel: "preconnect", href: "https://example.com" }],
    scripts: [{ inline: "window.__latticeHead = true;" }],
  },

  // An announcement above the header: a reader can close it, and it stays closed until the id changes
  banner: {
    text: {
      en: "Lattice 2.0 is out: what changed",
      ru: "Вышел Lattice 2.0: что изменилось",
    },
    href: "blog",
    id: "lattice-2",
  },

  i18n: {
    defaultLanguage: "en",
    languages: ["en", "ru"],
    labels: { en: "English", ru: "Русский" },
  },

  mdx: {
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
  },

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

  // The sections of the site. The blog is a page of the top navigation; the short changelog stays in the docs.
  features: [
    docs({
      versions: {
        list: [
          { id: "v2", label: "v2 (latest)", status: "latest" },
          { id: "v1", label: "v1", status: "deprecated" },
        ],
      },
    }),
    // A separate API reference page (top navigation), generated from an OpenAPI schema
    apiReference({ input: "./openapi.json", title: "API" }),
    status,
    examples,
    blog({
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
    }),
  ],

  // The top navigation is chosen here: places the sections offer (`consify links` lists them),
  // links of your own, and a drop-down menu.
  // The right side of the header is a component of this project (custom/header-end.tsx)
  slots: { headerEnd: HeaderEnd },

  header: {
    links: [
      "docs",
      "blog",
      {
        title: { en: "Developers", ru: "Разработчикам" },
        items: [
          "api",
          "status",
          "examples",
          "docs:llms",
          {
            title: "GitHub",
            description: { en: "Source code and issues", ru: "Исходный код и задачи" },
            url: "https://github.com/example/lattice",
          },
        ],
      },
    ],
  },

  // The home page is content/<language>/home.mdx, the header is chosen in `header.links` and the footer is
  // custom/footer.tsx: see the "Home, header and footer" page of the docs.

  // A static build is used by the end-to-end tests: `DEMO_STATIC=1 consify build`
  deploy: { mode: process.env.DEMO_STATIC === "1" ? "static" : "server" },
});
