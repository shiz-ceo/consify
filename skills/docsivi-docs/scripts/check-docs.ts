#!/usr/bin/env bun
// Checks the content of a docsivi project: translations, meta.json files, front matter, blog posts.
//
//   bun run check-docs.ts [--root <project>] [--languages en,ru] [--strict]
//
// --root       the project folder (default: the current folder)
// --languages  languages of the site; the first one is the main language. Without it the languages
//              are found from the names of the files (`page.ru.mdx` means `ru`).
// --strict     a missing translation is an error (otherwise a warning)
//
// Exits with code 1 when there is an error. No dependencies.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

const args = process.argv.slice(2);
const option = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
};
const root = option("root") ?? process.cwd();
const strict = args.includes("--strict");

const errors: string[] = [];
const warnings: string[] = [];
const rel = (path: string) => relative(root, path) || ".";

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const languageSuffix = /\.([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)\.(mdx|json)$/;

const files = [
  ...walk(join(root, "content")).filter(
    (f) => f.endsWith(".mdx") || basename(f).startsWith("meta"),
  ),
];
const mdx = files.filter((f) => f.endsWith(".mdx"));

// --- languages ---
let languages = option("languages")
  ?.split(",")
  .map((l) => l.trim())
  .filter(Boolean);
if (!languages) {
  const found = new Set<string>();
  for (const file of files) {
    const match = languageSuffix.exec(file);
    if (match?.[1]) found.add(match[1]);
  }
  languages = [...found];
}
const others = languages.slice(1);
const known = new Set(languages);

/** `guide.ru.mdx` -> { base: "guide.mdx", language: "ru" }; `guide.mdx` -> { base: "guide.mdx" }. */
function split(file: string): { base: string; language?: string } {
  const match = languageSuffix.exec(file);
  const language = match?.[1];
  if (match && language && (known.has(language) || languages?.length === 0)) {
    return { base: file.slice(0, -match[0].length) + `.${match[2]}`, language };
  }
  return { base: file };
}

// --- front matter and structure helpers ---
function frontMatter(text: string): string | undefined {
  return /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
}

function withoutCode(text: string): string {
  return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, "");
}

function codeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const pattern = /^(`{3,}|~{3,})([^\n]*)\n([\s\S]*?)\n\1[ \t]*$/gm;
  for (const match of text.matchAll(pattern)) blocks.push(`${match[2]}\n${match[3]}`);
  return blocks;
}

const internalLinks = (text: string): string[] =>
  [
    ...[...withoutCode(text).matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1] as string),
    ...[...withoutCode(text).matchAll(/href="([^"]*)"/g)].map((m) => m[1] as string),
  ].sort();

const headings = (text: string): number => (withoutCode(text).match(/^#{1,6}\s+\S/gm) ?? []).length;

// --- 1. front matter of every page ---
for (const file of mdx) {
  const text = readFileSync(file, "utf8");
  const header = frontMatter(text);
  if (header === undefined) {
    errors.push(`${rel(file)}: no front matter`);
    continue;
  }
  const isPost =
    rel(file).includes(`content${"/"}blog${"/"}`) || rel(file).includes("content\\blog\\");
  const required = isPost ? ["title", "description", "date"] : ["title"];
  for (const key of required) {
    if (!new RegExp(`^${key}:\\s*\\S`, "m").test(header)) {
      errors.push(`${rel(file)}: front matter has no "${key}"`);
    }
  }
  for (const line of header.split("\n")) {
    const match = /^(title|description|coverAlt):\s*(.+)$/.exec(line);
    const value = match?.[2]?.trim();
    if (match && value && !/^["'|>]/.test(value) && /:\s|\s#/.test(value)) {
      errors.push(
        `${rel(file)}: "${match[1]}" contains ": " or " #", put the value in double quotes`,
      );
    }
  }
}

// --- 2. translations ---
const byBase = new Map<string, Map<string, string>>();
for (const file of files) {
  const { base, language } = split(file);
  const entry = byBase.get(base) ?? new Map<string, string>();
  entry.set(language ?? "", file);
  byBase.set(base, entry);
}

function needsTranslation(metaFile: string): boolean {
  try {
    const meta = JSON.parse(readFileSync(metaFile, "utf8"));
    return meta.title !== undefined || (meta.pages ?? []).some((p: string) => /^---.*---$/.test(p));
  } catch {
    return true;
  }
}

const report = strict ? errors : warnings;
for (const [base, versions] of byBase) {
  const original = versions.get("");
  const isMeta = basename(base).startsWith("meta");
  if (!original) {
    for (const file of versions.values())
      errors.push(`${rel(file)}: there is no original file ${rel(base)}`);
    continue;
  }
  for (const language of others) {
    const translated = versions.get(language);
    if (!translated) {
      // a meta.json with no title and no separators has nothing to translate
      if (isMeta && !needsTranslation(original)) continue;
      report.push(`${rel(original)}: no "${language}" version`);
      continue;
    }
    if (isMeta) {
      try {
        const pages = (path: string) =>
          ((JSON.parse(readFileSync(path, "utf8")).pages ?? []) as string[]).filter(
            (p) => !/^---.*---$/.test(p),
          );
        const a = pages(original);
        const b = pages(translated);
        if (a.join("|") !== b.join("|")) {
          errors.push(`${rel(translated)}: "pages" differ from ${rel(original)}`);
        }
      } catch (error) {
        errors.push(`${rel(translated)}: invalid JSON (${(error as Error).message})`);
      }
      continue;
    }
    if (!base.endsWith(".mdx")) continue;
    const a = readFileSync(original, "utf8");
    const b = readFileSync(translated, "utf8");
    const blocksA = codeBlocks(a);
    const blocksB = codeBlocks(b);
    if (blocksA.length !== blocksB.length) {
      errors.push(
        `${rel(translated)}: ${blocksB.length} code blocks, the original has ${blocksA.length}`,
      );
    } else {
      blocksA.forEach((block, index) => {
        if (block !== blocksB[index])
          errors.push(`${rel(translated)}: code block ${index + 1} differs from the original`);
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

// --- 3. meta.json lists the pages of its folder ---
for (const file of files.filter(
  (f) => basename(f) === "meta.json" || /^meta\.[a-z-]+\.json$/.test(basename(f)),
)) {
  let pages: string[] | undefined;
  try {
    pages = JSON.parse(readFileSync(file, "utf8")).pages;
  } catch (error) {
    errors.push(`${rel(file)}: invalid JSON (${(error as Error).message})`);
    continue;
  }
  if (!Array.isArray(pages)) continue;
  const dir = dirname(file);
  const listed = pages.filter((p) => !/^---.*---$/.test(p) && p !== "...");
  for (const name of listed) {
    const clean = name.replace(/^!/, "");
    const exists =
      existsSync(join(dir, `${clean}.mdx`)) ||
      existsSync(join(dir, clean)) ||
      readdirSync(dir).some((f) => f.startsWith(`${clean}.`) && f.endsWith(".mdx"));
    if (!exists)
      errors.push(`${rel(file)}: "${name}" is listed but there is no such page or folder`);
  }
  if (pages.includes("...")) continue;
  const present = new Set<string>();
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) present.add(name);
    else if (name.endsWith(".mdx")) present.add(split(name).base.replace(/\.mdx$/, ""));
  }
  for (const name of present) {
    if (!listed.some((p) => p.replace(/^!/, "") === name)) {
      warnings.push(`${rel(file)}: "${name}" exists but is not listed in "pages"`);
    }
  }
}

// --- 4. every version of versions.list exists ---
const config = join(root, "docs.config.ts");
if (existsSync(config)) {
  const text = readFileSync(config, "utf8");
  const block = /versions:\s*{[\s\S]*?list:\s*\[([\s\S]*?)\]/.exec(text)?.[1] ?? "";
  for (const match of block.matchAll(/id:\s*["']([^"']+)["']/g)) {
    const folder = join(root, "content", "docs", match[1] as string);
    if (!existsSync(folder))
      errors.push(`docs.config.ts: version "${match[1]}" has no folder ${rel(folder)}`);
  }
}

// --- result ---
for (const warning of warnings) console.warn(`warning: ${warning}`);
for (const error of errors) console.error(`error: ${error}`);
console.log(
  `\nchecked ${mdx.length} pages, languages: ${languages.join(", ") || "(one)"}; ` +
    `${errors.length} error(s), ${warnings.length} warning(s)`,
);
process.exit(errors.length > 0 ? 1 : 0);
