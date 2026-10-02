// `consify anchors`: the English ids of the headings and their registry (`anchors.json` in the folder
// of every version of the original language). `check` reads the files and tells what disagrees, `sync`
// writes the registry from the headings, `add` writes the ids that the headings lack and fixes the links
// to them. The rules are in @consify/core (content/anchors.ts); here are the files and the report.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import {
  type AnchorDiagnostic,
  type AnchorPage,
  allFeatures,
  checkAnchors,
  contentDir,
  idsOf,
  linksOf,
  loadConfig,
  type Registry,
  registryKey,
  transliterate,
  validId,
} from "@consify/core/node";
import type { Command } from "commander";

type Config = Awaited<ReturnType<typeof loadConfig>>;
type Feature = ReturnType<typeof allFeatures>[number];

/** The features that have a registry of anchors. */
const anchorFeatures = (config: Config) => allFeatures(config).filter((f) => f.content?.anchors);

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((file) => file.split("\\").join("/"))
    .filter((file) => /\.mdx?$/.test(file) && !file.split("/").some((part) => part.startsWith(".")))
    .sort();
}

/** Every page of a feature in every language of the site. */
function pagesOf(cwd: string, feature: Feature, languages: readonly string[]): AnchorPage[] {
  return languages.flatMap((lang) => {
    const root = join(cwd, contentDir, lang, feature.id);
    return markdownFiles(root).map((path) => ({
      lang,
      path,
      text: readFileSync(join(root, path), "utf8"),
    }));
  });
}

const registryFile = (cwd: string, feature: Feature, lang: string, scope: string) =>
  join(cwd, contentDir, lang, feature.id, scope, "anchors.json");

function readRegistry(file: string): Registry | Error | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const value = JSON.parse(readFileSync(file, "utf8")) as unknown;
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      !Object.values(value).every(
        (ids) => Array.isArray(ids) && ids.every((id) => typeof id === "string"),
      )
    ) {
      return new Error('it must be an object: { "page.mdx": ["id", …] }');
    }
    return value as Registry;
  } catch (error) {
    return new Error((error as Error).message);
  }
}

function registriesOf(
  cwd: string,
  feature: Feature,
  defaultLanguage: string,
  pages: AnchorPage[],
): Map<string, Registry | Error | undefined> {
  const scope = feature.content?.anchors?.scope as (path: string) => string;
  return new Map(
    [...new Set(pages.map((page) => scope(page.path)))].map((name) => [
      name,
      readRegistry(registryFile(cwd, feature, defaultLanguage, name)),
    ]),
  );
}

/** What the files of the site say about the anchors, as `where` paths from the root of the project. */
export function anchorDiagnostics(cwd: string, config: Config): AnchorDiagnostic[] {
  const { defaultLanguage, languages } = config.i18n;
  return anchorFeatures(config).flatMap((feature) => {
    const rules = feature.content?.anchors;
    if (!rules) return [];
    const pages = pagesOf(cwd, feature, languages);
    const registries = registriesOf(cwd, feature, defaultLanguage, pages);
    return checkAnchors({ defaultLanguage, config: rules, pages, registries }).map((found) => {
      // `ru/v1/page.mdx:3` is the language, then the path inside the folder of the feature
      const slash = found.where.indexOf("/");
      const where = `${contentDir}/${found.where.slice(0, slash)}/${feature.id}/${found.where.slice(slash + 1)}`;
      return { ...found, where };
    });
  });
}

/** Prints the diagnostics; returns how many errors there are. */
export function printAnchorDiagnostics(found: AnchorDiagnostic[]): number {
  for (const item of found.filter((d) => d.level === "warn")) {
    console.warn(`warning: ${item.where}: ${item.message}`);
  }
  for (const item of found.filter((d) => d.level === "error")) {
    console.error(`error: ${item.where}: ${item.message}`);
  }
  return found.filter((d) => d.level === "error").length;
}

/** `consify anchors check`, and the step of `consify build`. Returns the exit code. */
export async function runAnchorsCheck(cwd: string, quiet = false): Promise<number> {
  const config = await loadConfig(cwd);
  if (anchorFeatures(config).length === 0) {
    if (!quiet) console.log("no feature has `anchors` on: nothing to check");
    return 0;
  }
  const found = anchorDiagnostics(cwd, config);
  const errors = printAnchorDiagnostics(found);
  const warnings = found.length - errors;
  if (!quiet || found.length > 0) {
    console.log(`\nanchors: ${errors} error(s), ${warnings} warning(s)`);
  }
  return errors > 0 ? 1 : 0;
}

/** True when the site has a feature with a registry of anchors (the build checks only then). */
export async function hasAnchors(cwd: string): Promise<boolean> {
  try {
    return anchorFeatures(await loadConfig(cwd)).length > 0;
  } catch {
    return false;
  }
}

/** The line width the project formats with (`biome.json`), 80 when it does not say. */
function lineWidth(cwd: string): number {
  for (let dir = cwd; ; dir = dirname(dir)) {
    for (const name of ["biome.json", "biome.jsonc"]) {
      const file = join(dir, name);
      if (!existsSync(file)) continue;
      try {
        const text = readFileSync(file, "utf8").replace(/^\s*\/\/.*$/gm, "");
        const width = (JSON.parse(text) as { formatter?: { lineWidth?: number } }).formatter
          ?.lineWidth;
        if (typeof width === "number") return width;
      } catch {
        // a file that is not plain JSON: the default
      }
    }
    if (dir === parse(dir).root) return 80;
  }
}

/**
 * The registry as JSON the way a formatter (Biome, Prettier) writes it: the ids of a page on one line
 * when they fit in `width`, one to a line when they do not. A formatter run over the file after
 * `consify anchors sync` then changes nothing.
 */
export function formatRegistry(registry: Registry, width: number): string {
  const entries = Object.entries(registry);
  if (entries.length === 0) return "{}\n";
  const lines = entries.map(([key, ids], index) => {
    const comma = index < entries.length - 1 ? "," : "";
    const name = `  ${JSON.stringify(key)}: `;
    const one = `${name}[${ids.map((id) => JSON.stringify(id)).join(", ")}]${comma}`;
    if (one.length <= width || ids.length === 0) return one;
    const each = ids.map((id, i) => `    ${JSON.stringify(id)}${i < ids.length - 1 ? "," : ""}`);
    return `${name}[\n${each.join("\n")}\n  ]${comma}`;
  });
  return `{\n${lines.join("\n")}\n}\n`;
}

function writeRegistry(cwd: string, file: string, registry: Registry, dry: boolean): void {
  if (dry) return;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, formatRegistry(registry, lineWidth(cwd)));
}

/**
 * The registry from the headings of the original language: every id of every page, in the order of
 * the page. An id that is in the registry and on no page stays (a link to it may exist) unless
 * `prune` is on.
 */
export async function runAnchorsSync(
  cwd: string,
  options: { prune?: boolean; dry?: boolean },
): Promise<number> {
  return syncAnchors(cwd, await loadConfig(cwd), options);
}

/** `runAnchorsSync` for a config that is already loaded. */
export function syncAnchors(
  cwd: string,
  config: Config,
  options: { prune?: boolean; dry?: boolean },
): number {
  const { defaultLanguage, languages } = config.i18n;
  let failed = false;
  for (const feature of anchorFeatures(config)) {
    const scope = feature.content?.anchors?.scope as (path: string) => string;
    const pages = pagesOf(cwd, feature, languages).filter((p) => p.lang === defaultLanguage);
    const scopes = [...new Set(pages.map((page) => scope(page.path)))];
    for (const name of scopes) {
      const file = registryFile(cwd, feature, defaultLanguage, name);
      const label = `${contentDir}/${defaultLanguage}/${feature.id}/${name ? `${name}/` : ""}anchors.json`;
      const current = readRegistry(file);
      if (current instanceof Error) {
        console.error(`error: ${label}: ${current.message}`);
        failed = true;
        continue;
      }
      const next: Registry = {};
      const lost: string[] = [];
      const skipped: string[] = [];
      for (const page of pages.filter((p) => scope(p.path) === name)) {
        const key = registryKey(name, page.path);
        const ids: string[] = [];
        for (const { heading, id } of idsOf(page.text)) {
          if (!validId.test(id)) {
            skipped.push(
              `${label.replace("anchors.json", "")}${key}:${heading.line}: "${heading.text}"`,
            );
            continue;
          }
          if (!ids.includes(id)) ids.push(id);
        }
        const old = current?.[key] ?? [];
        const kept = options.prune ? [] : old.filter((id) => !ids.includes(id));
        for (const id of old.filter((id) => !ids.includes(id))) lost.push(`${key}: ${id}`);
        if (ids.length + kept.length > 0) next[key] = [...ids, ...kept];
      }
      // a page that is gone but is in the registry stays too (its links), unless `prune`
      if (!options.prune) {
        for (const [key, ids] of Object.entries(current ?? {})) {
          if (!(key in next) && !pages.some((p) => registryKey(name, p.path) === key))
            next[key] = ids;
        }
      }
      const sorted = Object.fromEntries(
        Object.entries(next).sort(([a], [b]) => a.localeCompare(b)),
      );
      const added = Object.entries(sorted).reduce(
        (sum, [key, ids]) => sum + ids.filter((id) => !current?.[key]?.includes(id)).length,
        0,
      );
      const changed = JSON.stringify(sorted) !== JSON.stringify(current ?? {});
      if (changed) writeRegistry(cwd, file, sorted, options.dry === true);
      console.log(
        `${label}: ${changed ? (options.dry ? "would write" : "written") : "up to date"}, ${added} new id(s), ${lost.length} id(s) on no page${options.prune ? " (removed)" : lost.length ? " (kept)" : ""}`,
      );
      for (const item of lost) console.warn(`  warning: ${item} is on no page`);
      for (const item of skipped) {
        console.warn(`  skipped, not an English id (run \`consify anchors add\`): ${item}`);
      }
    }
  }
  return failed ? 1 : 0;
}

/** `text` with ` [#id]` at the end of `line` (1-based). */
function withId(text: string, line: number, id: string): string {
  const lines = text.split("\n");
  lines[line - 1] = `${(lines[line - 1] as string).replace(/\s+$/, "")} [#${id}]`;
  return lines.join("\n");
}

interface Change {
  lang: string;
  path: string;
  text: string;
  /** The ids that were made, old id of the page → new id. */
  renamed: Map<string, string>;
  notes: string[];
}

/**
 * Writes `[#id]` on the headings of a language that have none of their own that is a plain English word:
 * the original language gets a transliteration of the heading, a translation gets the id of the heading
 * at the same place in the original. Links to the old ids are made to go to the new ones.
 */
export async function runAnchorsAdd(
  cwd: string,
  options: { lang?: string | undefined; dry?: boolean },
): Promise<number> {
  return addAnchors(cwd, await loadConfig(cwd), options);
}

/** `runAnchorsAdd` for a config that is already loaded. */
export function addAnchors(
  cwd: string,
  config: Config,
  options: { lang?: string | undefined; dry?: boolean },
): number {
  const { defaultLanguage, languages } = config.i18n;
  if (options.lang !== undefined && !languages.includes(options.lang)) {
    console.error(`error: "${options.lang}" is not one of the languages of the site`);
    return 1;
  }
  const wanted = (lang: string) => options.lang === undefined || options.lang === lang;
  for (const feature of anchorFeatures(config)) {
    const pages = pagesOf(cwd, feature, languages);
    const changes = new Map<string, Change>();
    const key = (lang: string, path: string) => `${lang}\0${path}`;
    const original = new Map(
      pages.filter((p) => p.lang === defaultLanguage).map((p) => [p.path, p]),
    );
    const finalIds = new Map<string, string[]>();

    for (const page of pages.filter((p) => p.lang === defaultLanguage)) {
      let text = page.text;
      const renamed = new Map<string, string>();
      const notes: string[] = [];
      const taken = new Set(idsOf(page.text).map((entry) => entry.id));
      if (wanted(defaultLanguage)) {
        for (const { heading, id, explicit } of idsOf(page.text)) {
          if (explicit || validId.test(id)) continue;
          const base = transliterate(heading.text);
          if (!base) {
            notes.push(
              `${page.path}:${heading.line}: "${heading.text}" has no id to make: write [#id] by hand`,
            );
            continue;
          }
          let made = base;
          for (let n = 2; taken.has(made); n++) made = `${base}-${n}`;
          taken.add(made);
          renamed.set(id, made);
          text = withId(text, heading.line, made);
        }
      }
      finalIds.set(
        page.path,
        idsOf(text).map((entry) => entry.id),
      );
      if (text !== page.text || notes.length > 0) {
        changes.set(key(defaultLanguage, page.path), {
          lang: defaultLanguage,
          path: page.path,
          text,
          renamed,
          notes,
        });
      }
    }

    for (const page of pages.filter((p) => p.lang !== defaultLanguage && wanted(p.lang))) {
      const source = original.get(page.path);
      if (!source) continue;
      const wantedIds = finalIds.get(page.path) ?? [];
      const own = idsOf(page.text);
      const notes: string[] = [];
      if (own.length !== wantedIds.length) {
        notes.push(
          `${page.path}: ${own.length} headings, the original has ${wantedIds.length}: write [#id] by hand`,
        );
        changes.set(key(page.lang, page.path), { ...page, renamed: new Map(), notes });
        continue;
      }
      let text = page.text;
      const renamed = new Map<string, string>();
      own.forEach(({ heading, id, explicit }, index) => {
        const target = wantedIds[index] as string;
        if (id === target) return;
        if (explicit) {
          notes.push(
            `${page.path}:${heading.line}: the id "${id}" is not "${target}" of the original`,
          );
          return;
        }
        if (!validId.test(target)) return;
        renamed.set(id, target);
        text = withId(text, heading.line, target);
      });
      if (text !== page.text || notes.length > 0) {
        changes.set(key(page.lang, page.path), {
          lang: page.lang,
          path: page.path,
          text,
          renamed,
          notes,
        });
      }
    }

    // links to a heading by its old id go to the new one, in every page of the language
    for (const page of pages.filter((p) => wanted(p.lang))) {
      const own = changes.get(key(page.lang, page.path));
      let text = own?.text ?? page.text;
      const lines = text.split("\n");
      let edited = false;
      for (const link of linksOf(page.text, page.path)) {
        const to = changes.get(key(page.lang, link.path))?.renamed.get(link.hash);
        if (!to) continue;
        const at = link.target.indexOf("#");
        const target = `${link.target.slice(0, at)}#${to}`;
        const line = lines[link.line - 1] as string;
        lines[link.line - 1] = line.split(`](${link.target}`).join(`](${target}`);
        edited = true;
      }
      if (edited) {
        text = lines.join("\n");
        changes.set(key(page.lang, page.path), {
          ...(own ?? { lang: page.lang, path: page.path, renamed: new Map(), notes: [] }),
          text,
        });
      }
    }

    let made = 0;
    for (const change of changes.values()) {
      const root = join(cwd, contentDir, change.lang, feature.id);
      const before = pages.find((p) => p.lang === change.lang && p.path === change.path)?.text;
      const label = `${contentDir}/${change.lang}/${feature.id}/${change.path}`;
      if (before !== undefined && change.text !== before) {
        made += change.renamed.size;
        if (!options.dry) writeFileSync(join(root, change.path), change.text);
        console.log(
          `${options.dry ? "would change" : "changed"} ${label} (${change.renamed.size} id(s))`,
        );
      }
      for (const note of change.notes) {
        console.warn(`  warning: ${contentDir}/${change.lang}/${feature.id}/${note}`);
      }
    }
    console.log(
      `\n${feature.id}: ${made} id(s) ${options.dry ? "to make" : "made"}. Next: \`consify anchors sync\``,
    );
  }
  return 0;
}

/** Registers `anchors check | sync | add` on the root program. */
export function registerAnchorsCommand(program: Command): void {
  const anchors = program
    .command("anchors")
    .description("English ids of the headings and their registry (anchors.json)");
  anchors
    .command("check")
    .description("Check the headings and the links against anchors.json")
    .action(async () => {
      process.exitCode = await runAnchorsCheck(process.cwd());
    });
  anchors
    .command("sync")
    .description("Write anchors.json from the headings of the original language")
    .option("--prune", "remove the ids that are on no page (links to them are lost)")
    .option("--dry-run", "only say what would be written")
    .action(async (options: { prune?: boolean; dryRun?: boolean }) => {
      process.exitCode = await runAnchorsSync(process.cwd(), {
        ...(options.prune === undefined ? {} : { prune: options.prune }),
        dry: options.dryRun === true,
      });
    });
  anchors
    .command("add")
    .description("Write [#id] on the headings that have none (and fix the links to them)")
    .option("--lang <code>", "only this language (every language by default)")
    .option("--dry-run", "only say what would be changed")
    .action(async (options: { lang?: string; dryRun?: boolean }) => {
      process.exitCode = await runAnchorsAdd(process.cwd(), {
        lang: options.lang,
        dry: options.dryRun === true,
      });
    });
}
