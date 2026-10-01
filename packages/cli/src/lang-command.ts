import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  builtinLocales,
  coreMessageKeys,
  type DocsConfig,
  featureMessageKeys,
  languagePattern,
} from "@consify/core";
import { allFeatures, contentDir, loadConfig, renderLocaleTemplate } from "@consify/core/node";
import type { Command } from "commander";

/** Every file under `content/<lang>`, relative to that folder, with `/` separators. */
export function languageFiles(cwd: string, lang: string): string[] {
  const root = join(cwd, contentDir, lang);
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((file) => file.split("\\").join("/"))
    .filter((file) => /\.(mdx|json)$/.test(file))
    .sort();
}

const isPage = (file: string) => file.endsWith(".mdx");
/** `docs/v2/guide.mdx` is in the folder of the feature `docs`, `home.mdx` in the language folder itself. */
const sectionOf = (file: string) => (file.includes("/") ? (file.split("/")[0] as string) : "home");

export interface LanguageStatus {
  lang: string;
  /** Pages (`.mdx`) that exist / that the default language has, per feature. */
  pages: Record<string, { done: number; total: number }>;
  /** `meta.json` files (titles of the sidebar) that exist / that the default language has. */
  menus: { done: number; total: number };
  /** Files of the default language this language does not have. */
  missing: string[];
  /** Files this language has and the default language does not. */
  orphans: string[];
}

/** What is translated into every language of the site, compared with the default language. */
export function languageStatus(cwd: string, config: Readonly<DocsConfig>): LanguageStatus[] {
  const { defaultLanguage, languages } = config.i18n;
  const original = languageFiles(cwd, defaultLanguage);
  // in the order of the features of the site; the files of the language folder itself are "home"
  const order = allFeatures(config).map((feature) => feature.folder || "home");
  const rank = (section: string) =>
    order.includes(section) ? order.indexOf(section) : order.length;
  const sections = [...new Set(original.filter(isPage).map(sectionOf))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b),
  );
  const menusTotal = original.filter((file) => !isPage(file)).length;

  return languages.map((lang) => {
    const own = new Set(languageFiles(cwd, lang));
    const originals = new Set(original);
    const pages: LanguageStatus["pages"] = {};
    for (const section of sections) {
      const all = original.filter((file) => isPage(file) && sectionOf(file) === section);
      pages[section] = { done: all.filter((file) => own.has(file)).length, total: all.length };
    }
    return {
      lang,
      pages,
      menus: {
        done: original.filter((file) => !isPage(file) && own.has(file)).length,
        total: menusTotal,
      },
      missing: original.filter((file) => !own.has(file)),
      orphans: lang === defaultLanguage ? [] : [...own].filter((file) => !originals.has(file)),
    };
  });
}

interface PackStatus {
  text: string;
}

/** How much of the interface a language has: built in, a project pack with N of M strings, or nothing. */
async function interfaceStatus(
  cwd: string,
  config: Readonly<DocsConfig>,
  lang: string,
): Promise<PackStatus> {
  if (builtinLocales[lang]) return { text: "built in" };
  for (const ext of ["ts", "js", "json"]) {
    const file = join(cwd, "custom/locales", `${lang}.${ext}`);
    if (!existsSync(file)) continue;
    const pack = (
      ext === "json"
        ? JSON.parse(readFileSync(file, "utf8"))
        : (await import(pathToFileURL(file).href)).default
    ) as { messages?: Record<string, string>; ui?: Record<string, string> };
    const known = new Set([
      ...coreMessageKeys,
      ...featureMessageKeys(config.features),
      ...config.mdx.plugins.flatMap((p) => Object.values(p.messages ?? {}).flatMap(Object.keys)),
    ]);
    const done = Object.keys(pack.messages ?? {}).filter((key) => known.has(key)).length;
    return { text: `custom/locales/${lang}.${ext}: ${done}/${known.size} strings` };
  }
  return { text: "none (English)" };
}

function pad(text: string, width: number): string {
  return text.padEnd(width);
}

export interface LangStatusOptions {
  /** Show only this language. Default: all languages of the config. */
  language?: string | undefined;
  /** Also list the files a language is missing. */
  missing?: boolean | undefined;
}

/** `consify lang status [language] [--missing]`. Returns the exit code. */
export async function runLangStatus(options: LangStatusOptions, cwd: string): Promise<number> {
  const config = await loadConfig(cwd);
  const wanted = options.language;
  const showMissing = options.missing;
  const rows = languageStatus(cwd, config).filter((row) => !wanted || row.lang === wanted);
  if (rows.length === 0) {
    console.error(
      `"${wanted}" is not one of the languages of the site: ${config.i18n.languages.join(", ")}`,
    );
    return 1;
  }
  const sections = [...new Set(languageStatus(cwd, config).flatMap((r) => Object.keys(r.pages)))];
  const header = ["language", ...sections, "menus", "interface"];
  const lines: string[][] = [header];
  for (const row of rows) {
    const label = row.lang === config.i18n.defaultLanguage ? `${row.lang} (default)` : row.lang;
    lines.push([
      label,
      ...sections.map((s) => (row.pages[s] ? `${row.pages[s].done}/${row.pages[s].total}` : "-")),
      `${row.menus.done}/${row.menus.total}`,
      row.lang === config.i18n.defaultLanguage
        ? "-"
        : (await interfaceStatus(cwd, config, row.lang)).text,
    ]);
  }
  const widths = header.map((_, i) => Math.max(...lines.map((line) => (line[i] as string).length)));
  for (const line of lines) {
    console.log(
      line
        .map((cell, i) => pad(cell, widths[i] as number))
        .join("  ")
        .trimEnd(),
    );
  }
  console.log(
    "\nA page that a language does not have is shown in the default language (i18n.fallback).",
  );

  for (const row of rows) {
    if (row.orphans.length > 0) {
      console.log(
        `\n${row.lang}: ${row.orphans.length} file(s) have no original in ${config.i18n.defaultLanguage}: ${row.orphans.slice(0, 5).join(", ")}${row.orphans.length > 5 ? ", …" : ""}`,
      );
    }
    if (showMissing && row.lang !== config.i18n.defaultLanguage && row.missing.length > 0) {
      console.log(`\n${row.lang} is missing:`);
      for (const file of row.missing) console.log(`  content/${row.lang}/${file}`);
    }
  }
  return 0;
}

export interface LangAddOptions {
  /** The language tag to add, e.g. `fr`. */
  language: string;
  /** Also copy the pages, to be translated in place. */
  copy?: boolean | undefined;
}

/** `consify lang add <language> [--copy]`. Returns the exit code. */
export async function runLangAdd(options: LangAddOptions, cwd: string): Promise<number> {
  const lang = options.language;
  if (!lang || !languagePattern.test(lang)) {
    console.error("Usage: consify lang add <language> [--copy]   (a code such as de or pt-BR)");
    return 1;
  }
  const config = await loadConfig(cwd);
  const { defaultLanguage } = config.i18n;
  if (lang === defaultLanguage) {
    console.error(`"${lang}" is the default language, there is nothing to add.`);
    return 1;
  }
  const copy = options.copy;
  const original = languageFiles(cwd, defaultLanguage);
  let written = 0;
  for (const file of original) {
    // by default only the menus (`meta.json`, the titles of the sidebar) are prepared; `--copy`
    // copies the pages too, to be translated in place
    if (isPage(file) && !copy) continue;
    const target = join(cwd, contentDir, lang, file);
    if (existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(cwd, contentDir, defaultLanguage, file), target);
    written++;
  }
  mkdirSync(join(cwd, contentDir, lang), { recursive: true });

  const packFile = join(cwd, "custom/locales", `${lang}.ts`);
  const hasPack =
    builtinLocales[lang] !== undefined ||
    ["ts", "js", "json"].some((ext) => existsSync(join(cwd, "custom/locales", `${lang}.${ext}`)));
  if (!hasPack) {
    mkdirSync(dirname(packFile), { recursive: true });
    writeFileSync(packFile, renderLocaleTemplate(config, lang));
  }

  console.log(`Prepared content/${lang}/ (${written} file(s) copied from ${defaultLanguage}).`);
  if (!hasPack)
    console.log(`Wrote custom/locales/${lang}.ts: the strings of the interface to translate.`);
  console.log("Next:");
  if (!config.i18n.languages.includes(lang)) {
    console.log(`  1. add "${lang}" to i18n.languages in docs.config.ts`);
  }
  console.log(
    `  ${config.i18n.languages.includes(lang) ? "1" : "2"}. translate the files in content/${lang}/ (a page keeps the path and the file name of the original; without one the reader gets the ${defaultLanguage} page)`,
  );
  console.log(`  see what is left: consify lang status ${lang} --missing`);
  return 0;
}

/** Registers `lang add` and `lang status` on the root program. */
export function registerLangCommand(program: Command): void {
  const lang = program
    .command("lang")
    .description("Prepare a language, or show what is translated");
  lang
    .command("add <language>")
    .description("Prepare a new language (a code such as de or pt-BR)")
    .option("--copy", "also copy the pages, to be translated in place")
    .action(async (language: string, options: { copy?: boolean }) => {
      process.exitCode = await runLangAdd({ ...options, language }, process.cwd());
    });
  lang
    .command("status [language]")
    .description("What is translated, for one language or all of them")
    .option("--missing", "also list the files a language is missing")
    .action(async (language: string | undefined, options: { missing?: boolean }) => {
      process.exitCode = await runLangStatus({ ...options, language }, process.cwd());
    });
}
