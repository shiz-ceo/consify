import type { ComponentType } from "react";
import type { DocsConfig } from "../config/schema.ts";

/** A text in one language for every language, or one per language code. */
export type Localized<T = string> = T | Readonly<Record<string, T>>;

/** The strings of a feature in one language. */
export type Strings = Readonly<Record<string, string>>;

/** The parameters of a page address: `:service` in `"/:service"` is `params.service`, `*` is `params["*"]`. */
export type Params = Readonly<Record<string, string>>;

/**
 * A string of the feature (or of consify) in the language of the page. `{name}` in the string is
 * replaced by `values.name`.
 */
export type Translate<Key extends string = string> = {
  // a method, so a page written for any key (`page()`) fits a feature with known keys
  bivariant(key: Key, values?: Readonly<Record<string, string>>): string;
}["bivariant"];

/** What a page component gets. */
export interface PageProps<Data = unknown, Key extends string = string> {
  /** What `load` returned (`undefined` for a page without `load`). */
  data: Data;
  /** The language of the page, e.g. `"en"`. */
  lang: string;
  /** The parameters of the address: `params.slug` for `"/:slug"`, `params["*"]` for `"/*"`. */
  params: Params;
  /** A string of the feature (or of consify) in the language of the page. */
  t: Translate<Key>;
}

/** A heading of an MDX file, for a table of contents. */
export interface TocItem {
  /** The text of the heading. */
  title: string;
  /** The anchor of the heading: `#install`. */
  url: string;
  /** The level of the heading: 2 for `##`. */
  depth: number;
}

/** A file of `content/<language>/<feature>/`. */
export interface ContentFile {
  /** Relative to the folder of the feature, with `/`: `guides/setup.mdx`. */
  path: string;
  /** `path` without the extension and without a trailing `index`: `guides/setup`, `""` for `index.mdx`. */
  slug: string;
  /** The language the file is written in. */
  lang: string;
  /** The file is the one of the default language, shown because there is no translation. */
  fallback: boolean;
}

/** An MDX (or Markdown) file compiled on the server. Render it with `<Mdx code={file.code} />`. */
export interface MdxFile<Frontmatter = Record<string, unknown>> extends ContentFile {
  /** The front matter of the file. */
  frontmatter: Frontmatter;
  /** The compiled page, for `<Mdx />`. */
  code: string;
  /** The headings of the file, for a table of contents. */
  toc: TocItem[];
  /** The Markdown text without the front matter (for `llms.txt`, reading time, search). */
  text: string;
  /** Every language the file exists in. */
  languages: string[];
  /**
   * Headings and paragraphs of the file, for a search index. It is Fumadocs' `StructuredData`
   * (`{ headings: { id, content }[], contents: { heading, content }[] }`), typed `unknown` so
   * core does not export the Fumadocs type.
   */
  structuredData: unknown;
}

/** An MDX (or `.md`) file of a feature: one page of its content. */
export interface Entry<Data = Record<string, unknown>> {
  /** Its address in the feature: `v2/guide`, `hello`, `""` for `index.mdx`. */
  slug: string;
  /** Its page: `/en/docs/v2/guide`. */
  url: string;
  /** Relative to the folder of the feature: `v2/guide.mdx`. */
  path: string;
  /** The language it is written in. */
  lang: string;
  /**
   * It is the one of the default language, shown because there is no translation (and
   * `i18n.fallback` is not `show`): the page says so and points to the original.
   */
  fallback: boolean;
  /** The front matter, checked by `content.schema`. */
  data: Data;
  /** Minutes to read it, at least 1. */
  readingTime: number;
}

/** An entry with its text, for the page that shows it. */
export interface EntryPage<Data = Record<string, unknown>> extends Entry<Data> {
  /** The compiled text, for `<Mdx code={entry.code} />`. */
  code: string;
  /** The headings of the text, for a table of contents. */
  toc: TocItem[];
  /** Language → address of the same page in that language. */
  alternates: Record<string, string>;
  /** Its address in the default language (a page shown without a translation points there). */
  original: string;
  /**
   * The sidebar of the content, present only with `content.tree: true`. It is a Fumadocs page
   * tree (typed `unknown`): pass it to `useFumadocsLoader` and a Fumadocs `DocsLayout`.
   */
  tree?: unknown;
}

/** What `schema` of the content of a feature has to be: a Zod schema is one. */
export interface Schema<Data> {
  safeParse(input: unknown):
    | { success: true; data: Data }
    | {
        success: false;
        error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
      };
}

/**
 * The content of a feature: MDX files in `content/<language>/<feature>/`. Core reads them, checks
 * their front matter, translates, compiles, and can make a sidebar, a search, `llms.txt` and
 * social images of them. The feature only draws them.
 *
 * @example
 * import { z } from "zod";
 * import { defineFeature } from "@consify/core";
 *
 * export const blog = () =>
 *   defineFeature({
 *     id: "blog",
 *     content: {
 *       schema: z.object({ title: z.string(), date: z.coerce.date(), draft: z.boolean().optional() }),
 *       filter: (entry) => !entry.data.draft,
 *       sort: (a, b) => b.data.date.getTime() - a.data.date.getTime(),
 *       rss: true,
 *     },
 *   });
 */
export interface ContentOptions<Data = Record<string, unknown>> {
  /** Checks the front matter of every file (a Zod schema). A wrong one stops with the file named. */
  schema?: Schema<Data>;
  /** Leaves entries out: drafts, posts dated in the future. */
  filter?: (entry: Entry<Data>) => boolean;
  /**
   * The order of `content.entries()`.
   *
   * @default by path
   */
  sort?: (a: Entry<Data>, b: Entry<Data>) => number;
  /**
   * A sidebar from the folders and `meta.json` files (`entry.tree`).
   *
   * @default false
   */
  tree?: boolean;
  /**
   * The search dialog of the site searches the entries.
   *
   * @default true
   */
  search?: boolean;
  /**
   * `llms.txt` and `llms-full.txt`: the entries as text for AI agents.
   *
   * @default false
   */
  llms?: boolean;
  /**
   * A social image for every entry.
   *
   * @default false
   */
  og?: boolean;
  /**
   * An RSS feed of the entries (`/{lang}/<id>/rss.xml`): their `title`, `description`, `date`,
   * `categories` and `tags`, in the order of `sort`.
   *
   * @default false
   */
  rss?: boolean;
}

/**
 * The content of a feature: the files of `content/<language>/<feature>/`. A file that has no
 * translation is read from the default language, as `i18n.fallback` says (`fallback: true` on it);
 * with `fallback: "hide"` it does not exist in the other languages.
 */
export interface Content {
  /** The folder of this content in the current language: `/site/content/en/docs`. */
  readonly root: string;
  /** Every file under `dir` (the whole folder by default), in the language of the page. */
  list(dir?: string): Promise<ContentFile[]>;
  /** The text of a file, `undefined` when there is none. */
  read(path: string): Promise<string | undefined>;
  /** A JSON file parsed, `undefined` when there is none. Not checked: `T` is your promise. */
  json<T = unknown>(path: string): Promise<T | undefined>;
  /** The front matter of an MDX file, without compiling it. */
  frontmatter<T = Record<string, unknown>>(path: string): Promise<T | undefined>;
  /** An MDX file compiled for `<Mdx />`, with its front matter and headings. */
  mdx<T = Record<string, unknown>>(path: string): Promise<MdxFile<T> | undefined>;
  /** The same content in another language (with the same fallback). */
  in(lang: string): Content;
  /** Every entry of the feature in this language, checked, filtered and sorted (`content` of the feature). */
  entries<Data = Record<string, unknown>>(): Promise<Entry<Data>[]>;
  /** One entry with its compiled text, `undefined` when there is none. */
  entry<Data = Record<string, unknown>>(slug: string): Promise<EntryPage<Data> | undefined>;
}

/** What `load` of a page (or a file) gets. Runs on the server. */
export interface LoadContext<Key extends string = string> {
  /** The entry of a page with `entry: true`. */
  entry?: EntryPage;
  /** The language of the page. */
  lang: string;
  /** The parameters of the address. */
  params: Params;
  /** A string of the feature (or of consify) in the language of the page. */
  t: Translate<Key>;
  /** The content of the feature, in the language of the page. */
  content: Content;
  /** A file of the project, by its path from the project folder (`./openapi.json`). */
  readFile(path: string): Promise<string>;
  /** The config of the site, with the defaults applied. */
  config: Readonly<DocsConfig>;
  /** The request being answered. */
  request: Request;
  /** The absolute address of a path of the site (`site.url`), the path itself without it. */
  url(path: string): string;
  /** Answers with the 404 page. */
  notFound(): never;
  /** Sends the reader to another address. */
  redirect(to: string): never;
}

/** What `paths` of a page gets: it runs at build time, to list the addresses to pre-render. */
export interface PathsContext {
  lang: string;
  content: Content;
  config: Readonly<DocsConfig>;
}

/** What `title`, `description` and `meta` of a page get. */
export interface MetaContext<Data = unknown, Key extends string = string> {
  data: Data;
  lang: string;
  params: Params;
  t: Translate<Key>;
}

/** A tag of `<head>`: `{ name, content }`, `{ property, content }`, `{ tagName: "link", rel, href }`. */
export type HeadTag = Readonly<Record<string, string>>;

/**
 * The `<head>` of a page beyond its title: what `meta` of a page returns.
 *
 * @example
 * meta: ({ data, lang }) => ({
 *   title: data.title,
 *   description: data.summary,
 *   image: `/${lang}/blog/${data.slug}/og.png`,
 *   head: [{ property: "og:type", content: "article" }],
 * })
 */
export interface PageMeta {
  /** The `<title>` (and the social title). */
  title?: string | undefined;
  /** The meta description (and the social description). */
  description?: string | undefined;
  /** Path or URL of the social image. */
  image?: string | undefined;
  /** Language → path of the same page in that language (hreflang). */
  alternates?: Readonly<Record<string, string>> | undefined;
  /** Path of the original when this page is a copy (a page shown without a translation). */
  canonical?: string | undefined;
  /** More tags for `<head>`: `og:type`, a link to a feed. */
  head?: readonly HeadTag[] | undefined;
}

type MetaText<Data, Key extends string> =
  | string
  | ((context: MetaContext<Data, Key>) => string | undefined);

/**
 * How a page is drawn around its component: `site` (default) puts the header and the footer of the
 * site around it, `sidebar` also gives the header a button for a panel the page draws itself,
 * `none` leaves everything to the component.
 */
export type PageLayout = "site" | "sidebar" | "none";

/** A page with more than a component. */
export interface PageDefinition<Data = unknown, Key extends string = string> {
  /** Draws the page. It gets `data`, `lang`, `params` and `t`. */
  component: ComponentType<PageProps<Data, Key>>;
  /**
   * A page for every entry of the content: its address names the entry (`"/*"` or `"/:slug"`).
   * Core finds it, answers 404 without one, fills `<head>`, and gives it to the component as `data`
   * (or to `load` as `entry`, when the page needs more).
   */
  entry?: boolean;
  /** Reads what the page shows. Runs on the server, its result is `data` of the component. */
  load?: (context: LoadContext<Key>) => Data | Promise<Data>;
  /**
   * The parameters of a page with `:param` or `*` in its address, for every address that exists:
   * they are pre-rendered and listed in the sitemap. Without it such a page is only rendered on
   * demand, which a static site cannot do.
   */
  paths?: (context: PathsContext) => readonly Params[] | Promise<readonly Params[]>;
  /** `<title>`. Default: the title of the feature, then the name of the site. */
  title?: MetaText<Data, Key>;
  /** The meta description, fixed or from the data of the page. Default: `site.description`. */
  description?: MetaText<Data, Key>;
  /** Everything of the `<head>` at once; wins over `title` and `description`. */
  meta?: (context: MetaContext<Data, Key>) => PageMeta;
  /**
   * What surrounds the component: the header and footer of the site, or nothing.
   *
   * @default "site"
   */
  layout?: PageLayout;
}

/** An address that only sends the reader elsewhere: `{ redirect: ({ lang }) => \`/${lang}/docs/v2\` }`. */
export interface RedirectDefinition {
  redirect: (context: { lang: string; config: Readonly<DocsConfig> }) => string;
}

/** A page: a component, or a component with `load`, `paths`, `title`… */
export type PageInput<Data = unknown, Key extends string = string> =
  | ComponentType<PageProps<undefined, Key>>
  | PageDefinition<Data, Key>
  | RedirectDefinition;

/** What a file answers with: a `Response`, text, bytes, or anything else as JSON. */
export type FileBody = Response | string | Uint8Array | ArrayBuffer | object;

/** A file (a feed, JSON, an image): an address with no page. */
export interface FileDefinition<Key extends string = string> {
  /** Makes the body of the file. Runs on the server (or at build time for a static site). */
  load: (context: LoadContext<Key>) => FileBody | Promise<FileBody>;
  /** The parameters of a file with `:param` in its address, for every address that exists (see `PageDefinition.paths`). */
  paths?: PageDefinition["paths"];
}

/**
 * A file as `files` of a feature takes it: just the `load` function, or a definition with `paths`.
 *
 * @example
 * files: {
 *   "/hello.txt": () => "hello",
 *   "/data.json": async ({ content }) => (await content.json("data.json")) ?? {},
 * }
 */
export type FileInput<Key extends string = string> =
  | FileDefinition<Key>["load"]
  | FileDefinition<Key>;

/**
 * A place of the site a feature offers to link to. The site chooses where they go (`header.links`,
 * `footer.columns`); a feature with a `title` offers its front page by itself.
 */
export interface LinkOption {
  /** `<feature>` for the front page, `<feature>:<name>` for another place (`blog:rss`). */
  id: string;
  title: string;
  /** A few words about the place, shown in drop-down menus. */
  description?: string | undefined;
  /** With the language in it: `/en/blog`. */
  url: string;
  /** Listed in the header when the site does not choose its links. */
  primary?: boolean | undefined;
  external?: boolean | undefined;
}

/** What `links` of a feature gets. */
export interface LinksContext<Key extends string = string> {
  lang: string;
  t: Translate<Key>;
  config: Readonly<DocsConfig>;
}

/** What the search of a feature is told. */
export interface SearchContext {
  lang: string;
  /** `deploy.mode` is `static`: there is no server to ask. */
  isStatic: boolean;
}

/** One line of the search results: a page, a heading of it, or an excerpt. */
export interface SearchResult {
  /** Unique among the results. */
  id: string;
  /** Where the result leads, with the language in it. */
  url: string;
  /** A whole page, a heading in a page, or an excerpt of the text. */
  type: "page" | "heading" | "text";
  /** The text to show. */
  content: string;
  /** The path to the result, e.g. the names of the page and its parents. */
  breadcrumbs?: string[];
}

/** What a search hook returns to the search dialog of the site. */
export interface SearchState {
  search: string;
  setSearch: (search: string) => void;
  isLoading: boolean;
  /** `null` while there is nothing to show (an empty input). */
  items: SearchResult[] | null;
}

/**
 * The search of a feature. The site draws one dialog for every search; the feature says what it
 * finds (`useSearch`), or opens a search of its own (`open`, returns `false` when it is not there yet).
 */
export interface FeatureSearch {
  useSearch?: (context: SearchContext) => SearchState;
  open?: () => boolean;
}

/** `keyof` of every member of a union, joined (plain `keyof (A | B)` keeps only the shared keys). */
type KeysOfUnion<T> = T extends unknown ? keyof T : never;

/** Keys of the strings of a feature, from its `messages`: the keys of every language together. */
export type MessageKeys<M> = [M] extends [Readonly<Record<string, infer S>>]
  ? KeysOfUnion<S> & string
  : string;

/** A text of a feature in the language of the page: fixed, per language, or from its strings. */
export type FeatureText<Key extends string = string> =
  | Localized
  | ((context: { lang: string; t: Translate<Key> }) => string | undefined);

/** What `defineFeature` takes. */
export interface FeatureInput<Key extends string = string> {
  /** Lowercase letters, digits and `-`. The address (`/{lang}/<id>`), the content folder and the link id. */
  id: string;
  /** The address of the feature under the language, when it is not `id`. `""` is the front page (`/{lang}`). */
  path?: string;
  /** The folder of its content under `content/<language>/`, when it is not `id`. */
  folder?: string;
  /**
   * The link to the feature in the header, and the title of its pages. Without it the feature
   * offers no link. A function reads it from the strings: `({ t }) => t("blog")`.
   */
  title?: FeatureText<Key>;
  /** A few words about the feature for drop-down menus. */
  description?: FeatureText<Key>;
  /** Strings per language, for `t`. English is the reference: other languages fall back to it. */
  messages?: Readonly<Record<string, Strings>>;
  /**
   * Pages by address relative to the feature: `"/"`, `"/:slug"`, `"/*"`. Wrap a page that loads data
   * in `page()` to have its `data` typed.
   */
  pages?: Readonly<Record<string, PageInput<any, Key>>>;
  /** Files by address relative to the feature: `"/rss.xml"`, `"/:slug/og.png"`. */
  files?: Readonly<Record<string, FileInput<Key>>>;
  /** MDX content the feature shows: core reads, checks and translates it. */
  content?: ContentOptions<any>;
  /** More places to link to than the front page (`blog:rss`). */
  links?: (context: LinksContext<Key>) => readonly LinkOption[];
  /** MDX components this feature adds to every `.mdx` of the site. */
  components?: Readonly<Record<string, ComponentType<never>>>;
  search?: FeatureSearch;
}

/** A normalized page. */
export type Page =
  | (PageDefinition<unknown, string> & { kind: "page" })
  | (RedirectDefinition & { kind: "redirect" });

/** A normalized file. */
export type FileRoute = FileDefinition<string>;

/** A feature of the site, as `defineFeature` returns it. */
export interface Feature {
  readonly id: string;
  /** The address under the language: `id`, or `""` for the front page. */
  readonly path: string;
  /** The folder under `content/<language>/`. */
  readonly folder: string;
  /** Its MDX content, when it has some. */
  readonly content?: ContentOptions | undefined;
  readonly title?: FeatureText | undefined;
  readonly description?: FeatureText | undefined;
  readonly messages: Readonly<Record<string, Strings>>;
  readonly pages: Readonly<Record<string, Page>>;
  readonly files: Readonly<Record<string, FileRoute>>;
  readonly links?: ((context: LinksContext) => readonly LinkOption[]) | undefined;
  readonly components: Readonly<Record<string, ComponentType<never>>>;
  readonly search?: FeatureSearch | undefined;
}
