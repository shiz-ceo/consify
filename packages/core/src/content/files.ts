// `content` of a feature: the files of `content/<language>/<folder>/`, read on the server.
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";
import type { DocsConfig } from "../config/index.ts";
import type { Content, ContentFile, Feature, MdxFile } from "../feature/types.ts";
import { readEntries, readEntry } from "./collection.ts";
import { compileMdx, splitFrontmatter } from "./compile.ts";

/** The folder that holds the language folders. */
export const contentDir = "content";

/** `guides/setup.mdx` → `guides/setup`, `guides/index.mdx` → `guides`, `index.mdx` → `""`. */
export function slugOf(path: string): string {
  const withoutExtension = path.replace(/\.[^/.]+$/, "");
  return withoutExtension === "index" ? "" : withoutExtension.replace(/\/index$/, "");
}

/**
 * Where the files of `content/` come from, by their path in it (`en/docs/guide.mdx`): the disk
 * while the site is edited and built, the server bundle once it is built (`bundledSource`).
 */
export interface ContentSource {
  /** Names the source, for caches: two sources never share an entry. */
  readonly id: string;
  /** Every file under `dir`, relative to it, sorted, hidden files left out. `[]` without the folder. */
  walk(dir: string): string[];
  exists(path: string): boolean;
  read(path: string): Promise<string>;
}

const visible = (path: string) => !path.split("/").some((part) => part.startsWith("."));

/** The `content/` folder of the project on the disk. */
export function diskSource(cwd: string): ContentSource {
  const root = join(cwd, contentDir);
  return {
    id: root,
    walk(dir) {
      const full = join(root, dir);
      if (!existsSync(full)) return [];
      return readdirSync(full, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          join(entry.parentPath, entry.name)
            .slice(full.length + 1)
            .split("\\")
            .join("/"),
        )
        .filter(visible)
        .sort();
    },
    exists: (path) => existsSync(join(root, path)),
    read: (path) => readFile(join(root, path), "utf8"),
  };
}

/**
 * The content compiled into the server build: `import.meta.glob("/content/**", { query: "?raw" })`
 * of the generated `.consify/content.ts`. A built server needs no `content/` folder next to it.
 */
export function bundledSource(
  modules: Readonly<Record<string, () => Promise<unknown>>>,
): ContentSource {
  const files = new Map(
    Object.entries(modules).map(([key, load]) => [key.replace(/^\/?content\//, ""), load]),
  );
  const paths = [...files.keys()].filter(visible).sort();
  return {
    id: "bundle",
    walk(dir) {
      const prefix = dir ? `${dir.replace(/\/$/, "")}/` : "";
      return paths
        .filter((path) => path.startsWith(prefix))
        .map((path) => path.slice(prefix.length));
    },
    exists: (path) => files.has(path),
    async read(path) {
      const load = files.get(path);
      if (!load) throw new Error(`content: there is no ${path}`);
      return String(await load());
    },
  };
}

/** A path of a feature's content must stay inside its folder. */
function checkPath(path: string): string {
  const clean = normalize(path).split("\\").join("/").replace(/^\.\//, "");
  if (isAbsolute(path) || clean.startsWith("../") || clean === "..") {
    throw new Error(`content: "${path}" is outside of the content folder`);
  }
  return clean;
}

export interface CreateContentOptions {
  config: Readonly<DocsConfig>;
  /** The project folder. */
  cwd: string;
  /** Where the files come from: `content/` of `cwd` on the disk by default. */
  source?: ContentSource | undefined;
  /** The feature whose folder (`content/<language>/<folder>/`) and entries this is. */
  feature: Pick<Feature, "folder"> & Partial<Feature>;
  lang: string;
}

/** `content` for one feature and one language. */
export function createContent(options: CreateContentOptions): Content {
  const { config, cwd, feature, lang } = options;
  const store = options.source ?? diskSource(cwd);
  const { folder } = feature;
  const { defaultLanguage, fallback, languages } = config.i18n;
  // a path in `content/`: `en/docs`, `en` for a feature at the language folder itself
  const dirOf = (code: string) => (folder ? `${code}/${folder}` : code);
  const at = (code: string, path: string) => `${dirOf(code)}/${path}`;
  // the default language stands in for a missing translation, unless untranslated pages are hidden
  const standIn = lang !== defaultLanguage && fallback !== "hide" ? defaultLanguage : undefined;

  function locate(path: string): ContentFile | undefined {
    const clean = checkPath(path);
    for (const code of standIn ? [lang, standIn] : [lang]) {
      if (store.exists(at(code, clean))) {
        return { path: clean, slug: slugOf(clean), lang: code, fallback: code !== lang };
      }
    }
    return undefined;
  }

  async function read(path: string): Promise<string | undefined> {
    const file = locate(path);
    return file && store.read(at(file.lang, file.path));
  }

  const content: Content = {
    root: `${store.id}/${dirOf(lang)}`,

    async list(dir = "") {
      const prefix = dir ? `${checkPath(dir).replace(/\/$/, "")}/` : "";
      const own = store.walk(dirOf(lang) + (prefix ? `/${prefix}` : ""));
      const files: ContentFile[] = own.map((rel) => {
        const path = prefix + rel;
        return { path, slug: slugOf(path), lang, fallback: false };
      });
      if (standIn) {
        const translated = new Set(own);
        for (const rel of store.walk(dirOf(standIn) + (prefix ? `/${prefix}` : ""))) {
          if (translated.has(rel)) continue;
          const path = prefix + rel;
          files.push({ path, slug: slugOf(path), lang: standIn, fallback: true });
        }
      }
      return files.sort((a, b) => a.path.localeCompare(b.path));
    },

    read,

    async json<T>(path: string) {
      const text = await read(path);
      return text === undefined ? undefined : (JSON.parse(text) as T);
    },

    async frontmatter<T>(path: string) {
      const text = await read(path);
      return text === undefined ? undefined : (splitFrontmatter(text).data as T);
    },

    async mdx<T>(path: string): Promise<MdxFile<T> | undefined> {
      const file = locate(path);
      if (!file) return undefined;
      const source = await store.read(at(file.lang, file.path));
      const { data, body } = splitFrontmatter(source);
      const compiled = await compileMdx(
        config,
        cwd,
        body,
        join(contentDir, file.lang, folder, file.path),
      );
      return {
        ...file,
        frontmatter: data as T,
        code: compiled.code,
        toc: compiled.toc,
        text: body,
        languages: languages.filter((code) => store.exists(at(code, file.path))),
        structuredData: compiled.structuredData,
      };
    },

    in: (other) => createContent({ ...options, lang: other }),

    entries: (() => readEntries(feature as Feature, content, config, lang)) as Content["entries"],

    entry: ((slug: string) =>
      readEntry(feature as Feature, content, config, lang, slug)) as Content["entry"],
  };
  return content;
}
