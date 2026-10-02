// The content of a feature as entries: MDX files with checked front matter, their pages, the
// sidebar, the search index, `llms.txt` and social images. Runs on the server.
import { llms, loader, type MetaData, type Source } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/plugins/lucide-icons";
import type { DocsConfig } from "../config/index.ts";
import { encodePath, featureUrl } from "../feature/paths.ts";
import type { Content, Entry, EntryPage, Feature } from "../feature/types.ts";
import { completeMetaPages, fallbackBadgePlugin } from "../shared/fallback.ts";
import { fumadocsI18n } from "../shared/i18n.ts";
import { splitFrontmatter } from "./compile.ts";
import { ogFonts } from "./og-fonts.ts";

/**
 * Kept while the site runs, per config; built again on every request while it is edited
 * (`consify dev`).
 */
const caches = new WeakMap<object, Map<string, Promise<unknown>>>();
function cached<T>(config: object, key: string, make: () => Promise<T>): Promise<T> {
  if (import.meta.env?.DEV) return make();
  let cache = caches.get(config);
  if (!cache) {
    cache = new Map();
    caches.set(config, cache);
  }
  let value = cache.get(key) as Promise<T> | undefined;
  if (!value) {
    value = make();
    const all = cache;
    value.catch(() => all.delete(key));
    cache.set(key, value);
  }
  return value;
}

/** The address of an entry in a language: `/en/docs/v2/guide`. */
export function entryUrl(feature: Pick<Feature, "path">, lang: string, slug: string): string {
  // the same encoding as `fillUrl`, so an address built here equals the one a route builds
  return slug ? `${featureUrl(feature, lang)}/${encodePath(slug)}` : featureUrl(feature, lang);
}

function readingTime(text: string): number {
  return Math.max(1, Math.ceil(text.trim().split(/\s+/).filter(Boolean).length / 200));
}

/**
 * Every entry of a language: checked by the schema, filtered, sorted. Stops on a wrong file. Only
 * the parsing is kept; `filter` (future-dated posts) and `sort` run on every call, so a long-running
 * server does not freeze their result, and a caller may sort the returned array.
 */
export async function readEntries(
  feature: Feature,
  content: Content,
  config: Readonly<DocsConfig>,
  lang: string,
): Promise<Entry[]> {
  const parsed = await cached(config, `entries:${feature.id}:${content.root}`, async () => {
    const options = feature.content ?? {};
    const problems: string[] = [];
    const entries: Entry[] = [];
    const seen = new Map<string, string>();
    for (const file of await content.list()) {
      if (!/\.mdx?$/.test(file.path)) continue;
      const where = `content/${file.lang}/${feature.folder ? `${feature.folder}/` : ""}${file.path}`;
      // `guides.mdx` and `guides/index.mdx` are the same address
      const other = seen.get(file.slug);
      if (other !== undefined) {
        problems.push(`${where}: the same address as ${other} (/${file.slug}); keep one of them`);
        continue;
      }
      seen.set(file.slug, where);
      let header: Record<string, unknown>;
      let body: string;
      try {
        ({ data: header, body } = splitFrontmatter((await content.read(file.path)) ?? ""));
      } catch (error) {
        problems.push(`${where}: front matter: ${(error as Error).message.split("\n")[0]}`);
        continue;
      }
      let data: Record<string, unknown> = header;
      if (options.schema) {
        const result = options.schema.safeParse(header);
        if (!result.success) {
          for (const issue of result.error.issues) {
            problems.push(`${where}: ${issue.path.join(".") || "front matter"}: ${issue.message}`);
          }
          continue;
        }
        data = result.data as Record<string, unknown>;
      }
      const entry: Entry = {
        slug: file.slug,
        url: entryUrl(feature, lang, file.slug),
        path: file.path,
        lang: file.lang,
        // with `i18n.fallback: "show"` a page of the default language is shown as if translated
        fallback: file.fallback && config.i18n.fallback !== "show",
        data,
        readingTime: readingTime(body),
      };
      entries.push(entry);
    }
    if (problems.length > 0) {
      throw new Error(`Invalid content of "${feature.id}":\n  - ${problems.join("\n  - ")}`);
    }
    return entries;
  });
  const { filter, sort } = feature.content ?? {};
  const entries = filter ? parsed.filter((entry) => filter(entry)) : [...parsed];
  return sort ? entries.sort(sort) : entries;
}

/** One entry with its compiled text, its translations and (with `content.tree`) the sidebar. */
export async function readEntry(
  feature: Feature,
  content: Content,
  config: Readonly<DocsConfig>,
  lang: string,
  slug: string,
): Promise<EntryPage | undefined> {
  const entry = (await readEntries(feature, content, config, lang)).find((e) => e.slug === slug);
  if (!entry) return undefined;
  const file = await content.mdx(entry.path);
  if (!file) return undefined;
  const { defaultLanguage, fallback, languages } = config.i18n;
  const translated = fallback === "show" ? languages : file.languages;
  return {
    ...entry,
    code: file.code,
    toc: file.toc,
    alternates: Object.fromEntries(translated.map((code) => [code, entryUrl(feature, code, slug)])),
    original: entryUrl(feature, defaultLanguage, slug),
    ...(feature.content?.tree ? { tree: await sidebar(feature, content, config, lang) } : {}),
  };
}

/** The sidebar of a language, serialized for Fumadocs' `useFumadocsLoader`. */
async function sidebar(
  feature: Feature,
  content: Content,
  config: Readonly<DocsConfig>,
  lang: string,
): Promise<unknown> {
  const pages = await source(feature, content, config);
  return pages.serializePageTree(pages.getPageTree(lang));
}

interface PageData {
  title: string;
  description?: string | undefined;
  full?: boolean | undefined;
  icon?: string | undefined;
}

/**
 * The entries of every language as a Fumadocs source: the sidebar (folders and `meta.json`), the
 * search and `llms.txt` are made from it.
 */
function source(feature: Feature, content: Content, config: Readonly<DocsConfig>) {
  return cached(config, `source:${content.in(config.i18n.defaultLanguage).root}`, async () => {
    const files: { type: "page" | "meta"; path: string; data: unknown }[] = [];
    for (const lang of config.i18n.languages) {
      const own = content.in(lang);
      for (const entry of await readEntries(feature, own, config, lang)) {
        if (entry.lang !== lang) continue;
        const text = (key: string) =>
          typeof entry.data[key] === "string" ? (entry.data[key] as string) : undefined;
        const data: PageData = {
          // a page without a title is named after its file
          title: text("title") ?? entry.path.replace(/^.*\//, "").replace(/\.mdx?$/, ""),
          description: text("description"),
          full: entry.data.full === true,
          icon: text("icon"),
        };
        files.push({ type: "page", path: `${lang}/${entry.path}`, data });
      }
      for (const file of await own.list()) {
        if (!file.fallback && /(^|\/)meta\.json$/.test(file.path)) {
          files.push({
            type: "meta",
            path: `${lang}/${file.path}`,
            data: await own.json(file.path),
          });
        }
      }
    }
    const { defaultLanguage, fallback, languages } = config.i18n;
    const input = { files } as unknown as Source<{ pageData: PageData; metaData: MetaData }>;
    return loader({
      baseUrl: `/${feature.path}`,
      source: completeMetaPages(input, languages, defaultLanguage),
      i18n: fumadocsI18n(config),
      // `icon: "Rocket"` in front matter and meta.json (any Lucide icon name)
      plugins: [
        lucideIconsPlugin(),
        ...(fallback === "notice" ? [fallbackBadgePlugin(defaultLanguage)] : []),
      ],
    });
  });
}

/** The path of a page file inside the folder of its language: `en/v2/guide.mdx` → `v2/guide.mdx`. */
const inLanguage = (path: string) => path.slice(path.indexOf("/") + 1);

interface SearchServer {
  GET(request: Request): Promise<Response>;
  staticGET(): Promise<Response>;
}

/**
 * The search index of the entries: a server answers queries, a static site downloads the whole
 * index once (every language; the default tokenizer handles them all).
 */
export async function searchResponse(
  feature: Feature,
  content: Content,
  config: Readonly<DocsConfig>,
  request: Request,
): Promise<Response> {
  const server = cached(config, `search:${content.in(config.i18n.defaultLanguage).root}`, () =>
    import("fumadocs-core/search/server").then(
      ({ createFromSource }): SearchServer =>
        createFromSource(() => source(feature, content, config), {
          buildIndex: async (page) => {
            const file = await content
              .in(page.locale ?? config.i18n.defaultLanguage)
              .mdx(inLanguage(page.path));
            return {
              id: page.url,
              url: page.url,
              title: page.data.title,
              ...(page.data.description ? { description: page.data.description } : {}),
              ...(page.locale ? { locale: page.locale } : {}),
              structuredData: file?.structuredData as never,
            };
          },
        }),
    ),
  );
  const api = await server;
  return config.deploy.mode === "static" ? api.staticGET() : api.GET(request);
}

/** `llms.txt` (an index of the entries) or `llms-full.txt` (all of their text). */
export async function llmsText(
  feature: Feature,
  content: Content,
  config: Readonly<DocsConfig>,
  lang: string,
  full: boolean,
): Promise<string> {
  const text = llms(await source(feature, content, config), {
    renderPage: async (page) => {
      const body = (await content.markdown(inLanguage(page.path))) ?? "";
      return `# ${page.data.title} (${page.url})\n\n${body}`;
    },
  });
  return full ? text.full(lang) : text.index(lang);
}

/** The social image of an entry: `og/v2/guide.png` is the one of `v2/guide`. */
export async function ogImage(
  feature: Feature,
  content: Content,
  config: Readonly<DocsConfig>,
  lang: string,
  file: string,
): Promise<Response | undefined> {
  const slug = file.replace(/\.png$/, "");
  const entry = (await readEntries(feature, content, config, lang)).find(
    (e) => e.slug === (slug === "index" ? "" : slug),
  );
  if (!entry) return undefined;
  const { generateOGImage } = await import("fumadocs-ui/og/takumi");
  return generateOGImage({
    fonts: await ogFonts(),
    title: typeof entry.data.title === "string" ? entry.data.title : entry.slug,
    description: typeof entry.data.description === "string" ? entry.data.description : undefined,
    site: config.site.name,
    format: "png",
  });
}

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The RSS 2.0 feed of the entries of a language. `url` makes an address absolute. */
export async function rssText(
  feature: Feature,
  content: Content,
  config: Readonly<DocsConfig>,
  lang: string,
  title: string,
  url: (path: string) => string,
): Promise<string> {
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  const list = (value: unknown) =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const items = (await readEntries(feature, content, config, lang)).map((entry) => {
    const link = escapeXml(url(entry.url));
    const date = entry.data.date;
    const published = date instanceof Date || typeof date === "string" ? new Date(date) : undefined;
    return [
      "    <item>",
      `      <title>${escapeXml(text(entry.data.title) ?? entry.slug)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      ...(published ? [`      <pubDate>${published.toUTCString()}</pubDate>`] : []),
      ...(text(entry.data.description)
        ? [`      <description>${escapeXml(text(entry.data.description) as string)}</description>`]
        : []),
      ...[...list(entry.data.categories), ...list(entry.data.tags)].map(
        (category) => `      <category>${escapeXml(category)}</category>`,
      ),
      "    </item>",
    ].join("\n");
  });
  const home = featureUrl(feature, lang);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(url(home))}</link>
    <description>${escapeXml(config.site.description ?? title)}</description>
    <language>${escapeXml(lang)}</language>
    <atom:link href="${escapeXml(url(`${home}/rss.xml`))}" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;
}
