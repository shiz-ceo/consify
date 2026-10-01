// `consify check`: the content of a site — every address of every feature can be built, front
// matter is valid, translations match their originals, `meta.json` lists the pages of its folder.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { contentDir, loadConfig, siteAddresses, splitFrontmatter } from "@consify/core/node";
import type { Command } from "commander";

export interface CheckOptions {
  /** A missing translation is an error, not a warning. */
  strict?: boolean;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => join(entry.parentPath, entry.name));
}

const fence = /^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\1[ \t]*$/gm;
const withoutCode = (text: string) => text.replace(fence, "");
const codeBlocks = (text: string) =>
  [...text.matchAll(fence)].map((match) => `${match[2]}\n${match[3]}`);
const internalLinks = (text: string) =>
  [
    ...[...withoutCode(text).matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1] as string),
    ...[...withoutCode(text).matchAll(/href="([^"]*)"/g)].map((m) => m[1] as string),
  ].sort();
const headings = (text: string) => (withoutCode(text).match(/^#{1,6}\s+\S/gm) ?? []).length;
const isSeparator = (page: string) => /^---.*---$/.test(page);
/** `...` and `z...a` (the rest of the pages) and a link (`[Text](url)`, `external:[Text](url)`). */
const isRest = (page: string) => page === "..." || page === "z...a";
const isLink = (page: string) => /^(external:)?(\[[^\]]*\])?\[[^\]]*\]\([^)]*\)$/.test(page);

function metaPages(file: string): string[] | undefined {
  const pages = (JSON.parse(readFileSync(file, "utf8")) as { pages?: unknown }).pages;
  return Array.isArray(pages) ? (pages as string[]) : undefined;
}

/** Checks the site in `cwd`, prints what it found. Returns the exit code (1 on an error). */
export async function runCheck(options: CheckOptions, cwd: string): Promise<number> {
  const config = await loadConfig(cwd);
  const { defaultLanguage, languages } = config.i18n;
  const errors: string[] = [];
  const warnings: string[] = [];
  const root = join(cwd, contentDir);
  const rel = (path: string) => relative(cwd, path);

  // 1. every feature lists its addresses: a wrong blog post, a broken meta.json stop it
  try {
    await siteAddresses(config, cwd);
  } catch (error) {
    errors.push((error as Error).message);
  }

  // 2. every file is in a language of the site, and its front matter is valid YAML
  const byPath = new Map<string, Map<string, string>>();
  for (const file of walk(root)) {
    const [lang = "", ...rest] = relative(root, file).split(/[\\/]/);
    if (!languages.includes(lang)) {
      errors.push(`${rel(file)}: "${lang}" is not one of the languages of the site`);
      continue;
    }
    const path = rest.join("/");
    const versions = byPath.get(path) ?? new Map<string, string>();
    versions.set(lang, file);
    byPath.set(path, versions);
    if (/\.mdx?$/.test(file)) {
      try {
        splitFrontmatter(readFileSync(file, "utf8"));
      } catch (error) {
        errors.push(`${rel(file)}: front matter: ${(error as Error).message.split("\n")[0]}`);
      }
    }
  }

  // 3. translations: an original for each, the same code, links and headings
  const report = options.strict ? errors : warnings;
  for (const [path, versions] of byPath) {
    const original = versions.get(defaultLanguage);
    const isMeta = basename(path) === "meta.json";
    if (!original) {
      for (const file of versions.values()) {
        errors.push(`${rel(file)}: there is no original in content/${defaultLanguage}/${path}`);
      }
      continue;
    }
    for (const lang of languages.filter((code) => code !== defaultLanguage)) {
      const translated = versions.get(lang);
      if (!translated) {
        if (/\.mdx?$/.test(path)) report.push(`${rel(original)}: no "${lang}" version`);
        continue;
      }
      if (isMeta) {
        const pages = (file: string) => (metaPages(file) ?? []).filter((p) => !isSeparator(p));
        try {
          if (pages(original).join("|") !== pages(translated).join("|")) {
            errors.push(`${rel(translated)}: "pages" differ from ${rel(original)}`);
          }
        } catch {
          // invalid JSON: step 4 reports the file, comparing it here would only crash
        }
        continue;
      }
      if (!/\.mdx?$/.test(path)) continue;
      const a = readFileSync(original, "utf8");
      const b = readFileSync(translated, "utf8");
      const [blocksA, blocksB] = [codeBlocks(a), codeBlocks(b)];
      if (blocksA.length !== blocksB.length) {
        errors.push(
          `${rel(translated)}: ${blocksB.length} code blocks, the original has ${blocksA.length}`,
        );
      } else {
        blocksA.forEach((block, i) => {
          if (block !== blocksB[i])
            errors.push(`${rel(translated)}: code block ${i + 1} differs from the original`);
        });
      }
      if (internalLinks(a).join("\n") !== internalLinks(b).join("\n")) {
        errors.push(`${rel(translated)}: internal links or href values differ from the original`);
      }
      if (headings(a) !== headings(b)) {
        errors.push(`${rel(translated)}: ${headings(b)} headings, the original has ${headings(a)}`);
      }
    }
  }

  // 4. meta.json lists pages and folders that exist, and every one of them
  for (const file of walk(root).filter((f) => basename(f) === "meta.json")) {
    let pages: string[] | undefined;
    try {
      pages = metaPages(file);
    } catch (error) {
      errors.push(`${rel(file)}: invalid JSON (${(error as Error).message})`);
      continue;
    }
    if (!pages) continue;
    const dir = dirname(file);
    // a translated meta.json may list a page that is not translated: the original is shown there
    const [lang = "", ...rest] = relative(root, dir).split(/[\\/]/);
    const dirs = lang === defaultLanguage ? [dir] : [dir, join(root, defaultLanguage, ...rest)];
    const listed = pages
      .filter((p) => !isSeparator(p) && !isRest(p) && !isLink(p))
      // `...folder` puts the pages of a folder in place of the folder
      .map((p) => p.replace(/^(!|\.\.\.)/, ""));
    for (const name of listed) {
      const exists = dirs.some(
        (d) =>
          existsSync(join(d, `${name}.mdx`)) ||
          existsSync(join(d, `${name}.md`)) ||
          existsSync(join(d, name)),
      );
      if (!exists) {
        errors.push(`${rel(file)}: "${name}" is listed but there is no such page or folder`);
      }
    }
    if (pages.some(isRest)) continue;
    for (const name of readdirSync(dir)) {
      const isFolder = statSync(join(dir, name)).isDirectory();
      if (!isFolder && !/\.mdx?$/.test(name)) continue;
      const page = isFolder ? name : name.replace(/\.mdx?$/, "");
      if (!listed.includes(page)) {
        warnings.push(`${rel(file)}: "${page}" exists but is not listed in "pages"`);
      }
    }
  }

  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);
  console.log(
    `\nchecked ${byPath.size} files in ${languages.join(", ")}: ${errors.length} error(s), ${warnings.length} warning(s)`,
  );
  return errors.length > 0 ? 1 : 0;
}

/** Registers `check` (with `--strict`) on the root program. Called once by cli/program.ts. */
export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("Check the content: addresses, front matter, translations, meta.json")
    .option("--strict", "a missing translation is an error (otherwise a warning)")
    .action(async (options: CheckOptions) => {
      process.exitCode = await runCheck(options, process.cwd());
    });
}
