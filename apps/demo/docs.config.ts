import { defineConfig } from "docsivi";
import { externalLinks } from "./custom/plugins/external-links.ts";
import { githubAlerts } from "./custom/plugins/github-alerts.ts";

export default defineConfig({
  site: {
    name: "Lattice",
    description: "A typed job queue for TypeScript. Documentation demo built with docsivi.",
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
      en: "A typed job queue for TypeScript. Documentation demo built with docsivi.",
      ru: "Типизированная очередь задач для TypeScript. Демо документации на docsivi.",
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

  home: {
    en: {
      hero: {
        title: "Background jobs without the guesswork",
        description:
          "Lattice is a typed job queue for TypeScript. Define your job data once and get compile-time checks from the producer to the worker.",
        actions: [
          { label: "Get started", href: "/docs" },
          { label: "Why Lattice?", href: "/docs/v2/concepts", variant: "secondary" },
        ],
      },
      features: [
        {
          icon: "ShieldCheck",
          title: "End-to-end types",
          description: "One type describes a job. Producers, workers and handlers all share it.",
          href: "/docs/v2/concepts/jobs",
        },
        {
          icon: "RefreshCw",
          title: "Retries that make sense",
          description: "Backoff, dead-letter queues and idempotency keys are built in.",
          href: "/docs/v2/guides/retries",
        },
        {
          icon: "Clock",
          title: "Scheduling",
          description: "Delayed jobs, cron expressions and rate limits without extra services.",
          href: "/docs/v2/guides/scheduling",
        },
        {
          icon: "Plug",
          title: "Pluggable backends",
          description: "Start in memory, run on Redis or Postgres, or write your own backend.",
          href: "/docs/v2/guides/advanced/custom-backends",
        },
        {
          icon: "Activity",
          title: "Observability",
          description: "Metrics and traces out of the box, ready for OpenTelemetry.",
          href: "/docs/v2/guides/advanced/observability",
        },
        {
          icon: "BookOpen",
          title: "Writing docs like this",
          description: "See how this site is built: components, code blocks, plugins and themes.",
          href: "/docs/v2/writing",
        },
      ],
    },
    ru: {
      hero: {
        title: "Фоновые задачи без догадок",
        description:
          "Lattice — типизированная очередь задач для TypeScript. Опишите данные задачи один раз и получайте проверки типов от отправителя до обработчика.",
        actions: [
          { label: "Начать", href: "/docs" },
          { label: "Зачем нужен Lattice?", href: "/docs/v2/concepts", variant: "secondary" },
        ],
      },
      features: [
        {
          icon: "ShieldCheck",
          title: "Типы от начала до конца",
          description:
            "Один тип описывает задачу. Отправитель, воркер и обработчик используют его.",
          href: "/docs/v2/concepts/jobs",
        },
        {
          icon: "RefreshCw",
          title: "Разумные повторы",
          description: "Backoff, очереди недоставленных задач и ключи идемпотентности уже есть.",
          href: "/docs/v2/guides/retries",
        },
        {
          icon: "Clock",
          title: "Планирование",
          description: "Отложенные задачи, cron и ограничение частоты без дополнительных сервисов.",
          href: "/docs/v2/guides/scheduling",
        },
        {
          icon: "Plug",
          title: "Сменные бэкенды",
          description:
            "Начните в памяти, перейдите на Redis или Postgres или напишите свой бэкенд.",
        },
        {
          icon: "Activity",
          title: "Наблюдаемость",
          description: "Метрики и трейсы из коробки, совместимо с OpenTelemetry.",
        },
        {
          icon: "BookOpen",
          title: "Пишите документацию так же",
          description: "Как устроен этот сайт: компоненты, блоки кода, плагины и темы.",
          href: "/docs/v2/writing",
        },
      ],
    },
  },
});
