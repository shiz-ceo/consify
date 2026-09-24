import type { TableOfContents } from "fumadocs-core/toc";
import type { MDXContent } from "mdx/types";
import type { DocsConfig } from "../../config/index.ts";
import { type BlogPost, parsePostPath, pickLanguage, readingTime, sortByDate } from "./posts.ts";

/** A post file of the collection defined in `.docsivi/blog.ts`. */
export interface BlogEntry {
  info: { path: string };
  title: string;
  description: string;
  date: Date | string;
  categories: string[];
  tags: string[];
  authors: string[];
  cover?: string | undefined;
  coverAlt?: string | undefined;
  load(): Promise<{ toc: TableOfContents }>;
  preload(): Promise<void>;
  getText(type: "raw" | "processed"): Promise<string>;
  body: MDXContent;
}

export interface BlogCollection {
  entries: BlogEntry[];
  get(path: string): BlogEntry | undefined;
}

/**
 * The blog of a site: one post per slug, in the language asked for or else in the default language.
 * Only published files are in the collection (`.docsivi/blog.ts` leaves out drafts and posts dated
 * in the future), so nothing here can show an unpublished post.
 */
export function createBlog(config: Readonly<DocsConfig>, collection: BlogCollection) {
  const languages = config.i18n.languages;
  const defaultLanguage = config.i18n.defaultLanguage;

  const bySlug = new Map<string, { slug: string; lang: string | undefined; entry: BlogEntry }[]>();
  for (const entry of collection.entries) {
    const parsed = parsePostPath(entry.info.path, languages);
    if (!parsed) continue;
    const list = bySlug.get(parsed.slug) ?? [];
    list.push({ ...parsed, entry });
    bySlug.set(parsed.slug, list);
  }

  const cache = new Map<string, Promise<BlogPost>>();

  function toPost(slug: string, lang: string | undefined, entry: BlogEntry): Promise<BlogPost> {
    const key = entry.info.path;
    let post = cache.get(key);
    if (!post) {
      post = entry.getText("raw").then((text) => ({
        slug,
        lang: lang ?? defaultLanguage,
        title: entry.title,
        description: entry.description,
        date: new Date(entry.date).toISOString(),
        categories: [...entry.categories],
        tags: [...entry.tags],
        authors: [...entry.authors],
        cover: entry.cover,
        coverAlt: entry.coverAlt,
        readingTime: readingTime(text),
      }));
      cache.set(key, post);
    }
    return post;
  }

  return {
    config,
    collection,

    /** Slugs of all published posts. */
    slugs: (): string[] => [...bySlug.keys()],

    /** All published posts for a language, newest first. */
    async posts(lang: string): Promise<BlogPost[]> {
      const posts: BlogPost[] = [];
      for (const [slug, versions] of bySlug) {
        const chosen = pickLanguage(versions, lang, defaultLanguage);
        if (chosen) posts.push(await toPost(slug, chosen.lang, chosen.entry));
      }
      return sortByDate(posts);
    },

    /** One post with the file that holds its content. */
    async post(
      slug: string,
      lang: string,
    ): Promise<{ post: BlogPost; entry: BlogEntry } | undefined> {
      const versions = bySlug.get(slug);
      const chosen = versions && pickLanguage(versions, lang, defaultLanguage);
      if (!chosen) return undefined;
      return { post: await toPost(slug, chosen.lang, chosen.entry), entry: chosen.entry };
    },
  };
}

export type Blog = ReturnType<typeof createBlog>;
