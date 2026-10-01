import type { LoaderPlugin } from "fumadocs-core/source";
import { createElement, Fragment } from "react";
import type { DocsConfig } from "../config/index.ts";
import { localeLabel } from "../locales/registry.ts";

/**
 * Whether the file at `path` is written in `lang`: the first folder of the path is the language
 * (`ru/v2/guide.mdx` for `ru`).
 */
function isTranslatedPath(path: string, lang: string): boolean {
  return path.split("/")[0] === lang;
}

/** The name of a language as the language switcher shows it. */
export function languageLabel(config: Readonly<DocsConfig>, lang: string): string {
  return localeLabel(config, lang);
}

interface SourceFile {
  type: string;
  path: string;
  data: unknown;
}

const reported = new Set<string>();

/** Settings of a folder that are not text and are therefore taken from the default `meta.json`. */
const inheritedMetaKeys = ["root", "icon", "defaultOpen", "collapsible"] as const;

/**
 * A `meta.json` of a translation that lists some pages of its folder hides the others in the
 * sidebar of that language, so a page added to the default `meta.json` and forgotten in the
 * translated one disappears. This adds the pages that are missing from such a list at its end and
 * warns once, so nothing is lost and the author still learns where to put it. Lists that contain
 * `"..."` (the rest) are left alone. File paths start with the language folder (`ru/v2/meta.json`).
 */
export function completeMetaPages<S extends { files: readonly unknown[] }>(
  input: S,
  _languages: readonly string[],
  defaultLanguage: string,
  warn: (message: string) => void = console.warn,
): S {
  const source = input as unknown as { files: SourceFile[] };
  const inLanguage = (path: string) => {
    const slash = path.indexOf("/");
    return { lang: path.slice(0, slash), rel: path.slice(slash + 1) };
  };

  // page and folder names of every folder, from the files of every language
  const children = new Map<string, Set<string>>();
  const add = (dir: string, name: string) => {
    if (name === "index") return;
    (children.get(dir) ?? children.set(dir, new Set()).get(dir))?.add(name);
  };
  for (const file of source.files) {
    if (file.type !== "page") continue;
    const parts = inLanguage(file.path).rel.split("/");
    for (let depth = 0; depth < parts.length; depth++) {
      const dir = parts.slice(0, depth).join("/");
      const raw = parts[depth] as string;
      add(dir, depth === parts.length - 1 ? raw.replace(/\.mdx?$/, "") : raw);
    }
  }

  // the `meta.json` of the default language for every folder, for the settings a translation must not lose
  const defaults = new Map<string, Record<string, unknown>>();
  for (const file of source.files) {
    if (file.type !== "meta") continue;
    const { lang, rel } = inLanguage(file.path);
    const match = /(^|\/)meta\.json$/.exec(rel);
    if (lang === defaultLanguage && match && file.data && typeof file.data === "object") {
      defaults.set(rel.slice(0, match.index), file.data as Record<string, unknown>);
    }
  }

  return {
    ...input,
    files: source.files.map((file) => {
      if (file.type !== "meta") return file;
      const { lang, rel } = inLanguage(file.path);
      const match = /(^|\/)meta\.json$/.exec(rel);
      if (lang === defaultLanguage || !match) return file;
      const data = (file.data ?? {}) as Record<string, unknown>;
      const dir = rel.slice(0, match.index);
      const changes: Record<string, unknown> = {};

      // A translated meta.json only has to translate the title. What is not text (the version
      // root, the icon, whether the folder is open) comes from the default one, otherwise a
      // language would show the version switcher as a plain folder.
      const original = defaults.get(dir);
      for (const key of inheritedMetaKeys) {
        if (data[key] === undefined && original?.[key] !== undefined) changes[key] = original[key];
      }

      const pages = data.pages;
      if (Array.isArray(pages) && !pages.includes("...") && !pages.includes("z...a")) {
        const listed = new Set(
          (pages as string[])
            .filter((entry) => !/^(---|\[|external:|\()/.test(entry))
            .map((entry) => entry.replace(/^(!|\.\.\.)/, "")),
        );
        const missing = [...(children.get(dir) ?? [])].filter((name) => !listed.has(name));
        for (const name of missing) {
          const key = `${file.path}:${name}`;
          if (reported.has(key)) continue;
          reported.add(key);
          warn(
            `consify: ${file.path} does not list "${name}", so it was added at the end. List it in the file to choose its place.`,
          );
        }
        if (missing.length > 0) changes.pages = [...pages, ...missing];
      }

      if (Object.keys(changes).length === 0) return file;
      const completed = Object.assign(Object.create(Object.getPrototypeOf(data)), data, changes);
      return { ...file, data: completed };
    }),
  };
}

/**
 * Marks pages that are shown without a translation with the code of the default language (EN) in
 * the sidebar, so a reader sees which pages are not translated yet.
 */
export function fallbackBadgePlugin(defaultLanguage: string): LoaderPlugin {
  return {
    name: "consify:fallback-badge",
    transformPageTree: {
      file(node, filePath) {
        const context = this as unknown as {
          locale?: string;
          storage: { read(path: string): { format?: string; path?: string } | undefined };
        };
        const lang = context.locale;
        if (!lang || lang === defaultLanguage || !filePath) return node;
        const item = context.storage.read(filePath);
        if (item?.format !== "page" || !item.path) return node;
        if (isTranslatedPath(item.path, lang)) return node;
        node.name = createElement(
          Fragment,
          null,
          node.name,
          createElement(
            "span",
            {
              className:
                "ms-2 rounded border border-fd-border px-1 py-px text-[10px] font-medium leading-none text-fd-muted-foreground",
            },
            defaultLanguage.toUpperCase(),
          ),
        );
        return node;
      },
    },
  };
}
