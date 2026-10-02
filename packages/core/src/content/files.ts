// `content` of a feature: the files of `content/<language>/<folder>/`, read on the server.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";
import type { DocsConfig } from "../config/index.ts";
import type { Content, ContentFile, Feature, MdxFile } from "../feature/types.ts";
import { expandSnippetsText, type SnippetFiles } from "../mdx/snippets.ts";
import { readEntries, readEntry } from "./collection.ts";
import { compileMdx, splitFrontmatter } from "./compile.ts";
import { mdxParser } from "./snippets.ts";

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
  /** The folder of the snippets (`snippets`, from the project folder), when the source has it. */
  snippets?(dir: string): SnippetStore;
}

/** The files of a folder of snippets. */
export interface SnippetStore extends SnippetFiles {
  /** Changes when a file of the folder is added, removed or edited: the pages that use one are compiled again. */
  fingerprint(): string;
}

const visible = (path: string) => !path.split("/").some((part) => part.startsWith("."));

/** Every file under `full`, relative to it, sorted, hidden files left out. */
function walkDisk(full: string): string[] {
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
}

/** The `content/` folder of the project on the disk. */
export function diskSource(cwd: string): ContentSource {
  const root = join(cwd, contentDir);
  return {
    id: root,
    walk: (dir) => walkDisk(join(root, dir)),
    exists: (path) => existsSync(join(root, path)),
    read: (path) => readFile(join(root, path), "utf8"),
    snippets(dir) {
      const folder = join(cwd, checkPath(dir));
      return {
        list: () => walkDisk(folder),
        read: (path) => readFile(join(folder, checkPath(path)), "utf8"),
        fingerprint() {
          const hash = createHash("sha1");
          for (const path of walkDisk(folder)) {
            const { mtimeMs, size } = statSync(join(folder, path));
            hash.update(`${path}\0${mtimeMs}\0${size}\0`);
          }
          return hash.digest("hex");
        },
      };
    },
  };
}

/**
 * The content compiled into the server build: `import.meta.glob("/content/**", { query: "?raw" })`
 * of the generated `.consify/content.ts`, and the snippets the same way (`/snippets/**`). A built
 * server needs no `content/` folder next to it.
 */
export function bundledSource(
  modules: Readonly<Record<string, () => Promise<unknown>>>,
  snippetModules: Readonly<Record<string, () => Promise<unknown>>> = {},
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
    snippets(dir) {
      const prefix = `${dir.replace(/^\.?\//, "").replace(/\/$/, "")}/`;
      const own = new Map(
        Object.entries(snippetModules)
          .map(([key, load]) => [key.replace(/^\//, ""), load] as const)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, load]) => [key.slice(prefix.length), load]),
      );
      const list = [...own.keys()].filter(visible).sort();
      return {
        list: () => list,
        async read(path) {
          const load = own.get(path);
          if (!load) throw new Error(`snippets: there is no ${prefix}${path}`);
          return String(await load());
        },
        // the bundle does not change while the server runs
        fingerprint: () => "bundle",
      };
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
  const snippets = feature.content?.snippets;

  /** The snippets of a file: from the folder of its version, in the language it is written in. */
  function snippetsOf(file: ContentFile) {
    if (!snippets || !store.snippets) return undefined;
    return {
      files: store.snippets(snippets.dir),
      dir: snippets.dir,
      lang: file.lang,
      version: snippets.version(file.path),
    };
  }

  /** The text of a file with its snippets in place, for `llms.txt` and the link cards. */
  async function withSnippets(body: string, file: ContentFile): Promise<string> {
    const found = snippetsOf(file);
    if (!found || !body.includes("<Snippet")) return body;
    return expandSnippetsText(body, {
      files: found.files,
      dir: found.dir,
      place: { lang: found.lang, version: found.version, defaultLanguage, languages },
      parse: mdxParser(config),
    });
  }

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

    async markdown(path: string) {
      const file = locate(path);
      if (!file) return undefined;
      return withSnippets(splitFrontmatter(await store.read(at(file.lang, file.path))).body, file);
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
      const found = snippetsOf(file);
      const compiled = await compileMdx(
        config,
        cwd,
        body,
        join(contentDir, file.lang, folder, file.path),
        found ? { snippets: found } : undefined,
      );
      return {
        ...file,
        frontmatter: data as T,
        code: compiled.code,
        toc: compiled.toc,
        text: await withSnippets(body, file),
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
