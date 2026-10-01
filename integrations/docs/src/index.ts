// The docs: what they are made of, for `docs.config.ts`. The page is in page.tsx. No JSX here:
// Node reads this module with `docs.config.ts`.
import {
  type DocsConfig,
  defineFeature,
  type EntryPage,
  type MessagesOf,
  page,
} from "@consify/core";
import { lazy } from "react";
import { z } from "zod";
import { deprecationOf, versionsSchema } from "./versions.ts";

// --- strings ---

/** The strings of the docs. `i18n.messages` in `docs.config.ts` overrides any of them. */
export const docsMessages = {
  en: {
    documentation: "Documentation",
    documentationHint: "Guides and reference",
    llmsHint: "The docs as text for AI agents",
    deprecatedVersion:
      "You are viewing the documentation for {version}, which is no longer maintained.",
    goToLatest: "Go to {latest}",
    editOnGithub: "Edit this page on GitHub",
  },
  ru: {
    documentation: "Документация",
    documentationHint: "Руководства и справочник",
    llmsHint: "Документация текстом для ИИ-агентов",
    deprecatedVersion: "Вы читаете документацию для {version}, она больше не поддерживается.",
    goToLatest: "Перейти к {latest}",
    editOnGithub: "Редактировать страницу на GitHub",
  },
} as const;

export type DocsMessages = MessagesOf<typeof docsMessages>;

// --- options ---

const flag = z.boolean().default(true);

const localizedText = z.union([z.string().min(1), z.record(z.string(), z.string().min(1))]);

/** The options of `docs()`. */
const docsOptionsSchema = z.strictObject({
  /**
   * The address (`/{lang}/<id>`), content folder (`content/<language>/<id>/`) and link id. Set it
   * for a second docs feature.
   *
   * @default "docs"
   */
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, "must be lowercase letters, digits and `-`")
    .default("docs"),
  /**
   * The text of its link in the header, or one text per language.
   *
   * @default "Documentation", translated
   */
  title: localizedText.optional(),
  /**
   * Several versions of the docs, each in its own folder inside the folder of this feature
   * (`content/<language>/<id>/<version>/`, `<id>` is `docs` by default), with a switcher.
   */
  versions: versionsSchema.prefault({}),
  /**
   * The table of contents of a page.
   *
   * @default true
   */
  toc: flag,
  /**
   * The path of the page above its title (`Guides > Setup`).
   *
   * @default true
   */
  breadcrumbs: flag,
  /**
   * Previous and next links under a page.
   *
   * @default true
   */
  pagination: flag,
  /**
   * `llms.txt` and `llms-full.txt`: the docs as plain text for AI agents.
   *
   * @default true
   */
  llmsTxt: flag,
  /**
   * A generated social image for every page.
   *
   * @default true
   */
  og: flag,
  /**
   * The "Edit this page on GitHub" link (it needs `site.github`). `{ contentDir }` sets the folder
   * that holds the language folders in the repository, `content` by default.
   *
   * @default true
   */
  editOnGithub: z
    .union([z.boolean(), z.strictObject({ contentDir: z.string().min(1) })])
    .default(true),
});

/** What you pass to `docs()`. */
export type DocsOptionsInput = z.input<typeof docsOptionsSchema>;
/** The options with the defaults applied. */
export type DocsOptions = z.output<typeof docsOptionsSchema>;

// --- the feature ---

// The page is loaded when it is shown: Node reads this module with `docs.config.ts`.
const DocsPage = lazy(() => import("./page.tsx"));

/** The front matter of a docs page. */
const frontmatter = z.looseObject({
  title: z.string().min(1),
  description: z.string().optional(),
  /** No table of contents, the page takes the whole width. */
  full: z.boolean().optional(),
  /** A Lucide icon in the sidebar: `Rocket`. */
  icon: z.string().optional(),
});

/** What the page of a docs entry shows: the entry, and what the feature says about it. */
function pageData(
  entry: EntryPage,
  options: DocsOptions,
  config: Readonly<DocsConfig>,
  lang: string,
) {
  const { id } = options;
  const github = config.site.github;
  const contentDir =
    typeof options.editOnGithub === "object" ? options.editOnGithub.contentDir : "content";
  const deprecated = deprecationOf(options.versions, entry.slug.split("/"));
  return {
    ...(entry as EntryPage<z.output<typeof frontmatter>>),
    /** The feature: its search and header. */
    id,
    show: { toc: options.toc, breadcrumbs: options.breadcrumbs, pagination: options.pagination },
    editUrl:
      options.editOnGithub && github
        ? `https://github.com/${github.repo}/blob/${github.branch}/${contentDir}/${entry.lang}/${id}/${entry.path}`
        : undefined,
    deprecated: deprecated && {
      version: deprecated.version.label ?? deprecated.version.id,
      latest: deprecated.latest && {
        label: deprecated.latest.label ?? deprecated.latest.id,
        url: `/${lang}/${id}/${deprecated.latest.id}`,
      },
    },
  };
}

export type DocsPageData = ReturnType<typeof pageData>;

/**
 * The documentation: MDX pages in `content/<language>/docs/` with a sidebar from folders and
 * `meta.json`, a table of contents, search, versions, translations, `llms.txt` and social images.
 *
 * @example
 * features: [docs({ versions: { list: [{ id: "v2", status: "latest" }, { id: "v1" }] } })]
 * features: [docs(), docs({ id: "guides", title: "Guides" })] // a second docs feature at /{lang}/guides
 */
export function docs(input: DocsOptionsInput = {}) {
  const parsed = docsOptionsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `docs(): ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const options: DocsOptions = parsed.data;
  const { id } = options;
  const defaultVersion = options.versions.default;

  return defineFeature({
    id,
    title: options.title ?? (({ t }) => t("documentation")),
    description: ({ t }) => t("documentationHint"),
    messages: docsMessages,
    content: { schema: frontmatter, tree: true, llms: options.llmsTxt, og: options.og },
    pages: {
      // a versioned docs feature opens its default version
      ...(defaultVersion === undefined
        ? {}
        : { "/": { redirect: ({ lang }) => `/${lang}/${id}/${defaultVersion}` } }),
      "/*": page({
        entry: true,
        layout: "none",
        load: ({ entry, config, lang }) => pageData(entry as EntryPage, options, config, lang),
        component: DocsPage,
      }),
    },
  });
}
