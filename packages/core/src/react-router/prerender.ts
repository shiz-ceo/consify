import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { DocsConfig } from "../config/index.ts";

/**
 * Page slugs found in the content folder, without the language: `index.ru.mdx` and `index.mdx`
 * both give the slug of `index`. A page is served in every language (untranslated ones fall back
 * to the default language), so the union over all files is what has to be rendered.
 */
export function collectSlugs(files: readonly string[], languages: readonly string[]): string[][] {
  const seen = new Set<string>();
  const slugs: string[][] = [];
  for (const file of files) {
    if (!file.endsWith(".mdx")) continue;
    const parts = file.slice(0, -".mdx".length).split("/");
    const last = parts.pop() as string;
    const dot = last.lastIndexOf(".");
    const name = dot > 0 && languages.includes(last.slice(dot + 1)) ? last.slice(0, dot) : last;
    if (name !== "index") parts.push(name);
    const key = parts.join("/");
    if (!seen.has(key)) {
      seen.add(key);
      slugs.push(parts);
    }
  }
  return slugs;
}

function listFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { recursive: true, encoding: "utf8" }).map((f) =>
      f.split("\\").join("/"),
    );
  } catch {
    return [];
  }
}

/**
 * Every URL to pre-render: home, docs, OG images and llms files per language, plus sitemap and
 * robots. In static mode also `/` (language redirect page) and the search index.
 */
export function prerenderPaths(
  config: Readonly<DocsConfig>,
  cwd: string = process.cwd(),
  /** Extra URLs, e.g. the API reference pages. */
  extra: readonly string[] = [],
): string[] {
  const { languages } = config.i18n;
  const slugs = collectSlugs(listFiles(join(cwd, "content/docs")), languages);
  const isStatic = config.deploy.mode === "static";

  const paths = ["/sitemap.xml", "/robots.txt"];
  if (isStatic) paths.push("/", "/api/search");

  for (const lang of languages) {
    paths.push(`/${lang}`, `/${lang}/llms.txt`, `/${lang}/llms-full.txt`);
    // `/{lang}/docs` redirects to the default version. On a server that has to stay a real HTTP
    // redirect (pre-rendering it would give a page with a delayed meta refresh instead).
    if (isStatic || config.versions.default === undefined) paths.push(`/${lang}/docs`);
    for (const slug of slugs) {
      const path = slug.join("/");
      paths.push(`/${lang}/docs${path ? `/${path}` : ""}`);
      if (config.features.og) paths.push(`/${lang}/og/${path ? `${path}/` : ""}image.png`);
    }
  }
  // `/{lang}/api` is the API reference entry (it redirects to the first operation)
  if (config.openapi) {
    for (const lang of languages) if (isStatic) paths.push(`/${lang}/api`);
  }
  paths.push(...extra);
  return [...new Set(paths)];
}
