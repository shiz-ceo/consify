import type { TableOfContents } from "fumadocs-core/toc";
import type { MDXContent } from "mdx/types";
import { z } from "zod";
import type { DocsConfig } from "../../config/index.ts";

/** The header of `content/home.mdx`: everything is optional. */
export const homeFrontmatterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

/** A file of the collection defined in `.docsivi/home.ts`. */
export interface HomeEntry {
  info: { path: string };
  title?: string | undefined;
  description?: string | undefined;
  load(): Promise<{ toc: TableOfContents }>;
  preload(): Promise<void>;
  body: MDXContent;
}

export interface HomeCollection {
  entries: HomeEntry[];
  get(path: string): HomeEntry | undefined;
}

/** `home.mdx` is the page in the default language, `home.ru.mdx` the one in Russian. */
export function homeFileName(lang: string, defaultLanguage: string): string[] {
  return lang === defaultLanguage ? [`home.${lang}.mdx`, "home.mdx"] : [`home.${lang}.mdx`];
}

/**
 * The home page written in MDX. A language without its own file shows the page of the default
 * language, like the rest of the content.
 */
export function createHome(config: Readonly<DocsConfig>, collection: HomeCollection) {
  const { defaultLanguage } = config.i18n;
  const byPath = new Map(collection.entries.map((entry) => [entry.info.path, entry]));

  return {
    /** The file for a language, or the one of the default language. */
    entry(lang: string): HomeEntry | undefined {
      for (const candidate of [lang, defaultLanguage]) {
        for (const name of homeFileName(candidate, defaultLanguage)) {
          const entry = byPath.get(name);
          if (entry) return entry;
        }
      }
      return undefined;
    },
    collection,
  };
}

export type MdxHome = ReturnType<typeof createHome>;
