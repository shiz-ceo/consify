// `consify snippets`: the files of `snippets/<version>/` that pages put in place with
// `<Snippet id="…" />`. `check` reads the pages and the folder and tells what disagrees (it is a step of
// `consify check` and of `consify build`), `find` lists the code blocks that are written on several
// pages, the ones a snippet would keep in one place. The rules are in @consify/core
// (content/snippets.ts); here are the files and the report.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  allFeatures,
  checkSnippets,
  contentDir,
  diskSource,
  loadConfig,
  mdxParser,
  type SnippetDiagnostic,
  type SnippetPage,
  withoutVersion,
} from "@consify/core/node";
import type { Command } from "commander";

type Config = Awaited<ReturnType<typeof loadConfig>>;
type Feature = ReturnType<typeof allFeatures>[number];

/** The features that have snippets. */
const snippetFeatures = (config: Config) => allFeatures(config).filter((f) => f.content?.snippets);

function markdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((file) => file.split("\\").join("/"))
    .filter((file) => /\.mdx?$/.test(file) && !file.split("/").some((part) => part.startsWith(".")))
    .sort();
}

/** Every page of a feature in every language, with the file it is in. */
function pagesOf(cwd: string, feature: Feature, languages: readonly string[]) {
  return languages.flatMap((lang) => {
    const root = join(cwd, contentDir, lang, feature.folder);
    return markdownFiles(root).map((path) => ({
      lang,
      path,
      file: `${contentDir}/${lang}/${feature.folder}/${path}`,
      text: readFileSync(join(root, path), "utf8"),
    }));
  });
}

/** What the pages and the folders of snippets say, as `where` paths from the root of the project. */
export async function snippetDiagnostics(
  cwd: string,
  config: Config,
): Promise<SnippetDiagnostic[]> {
  const { defaultLanguage, languages } = config.i18n;
  const features = snippetFeatures(config);
  const source = diskSource(cwd);
  const found: SnippetDiagnostic[] = [];
  // two features may share a folder: its files are checked against the pages of both
  for (const dir of [...new Set(features.map((f) => f.content?.snippets?.dir as string))]) {
    const own = features.filter((f) => f.content?.snippets?.dir === dir);
    const pages: SnippetPage[] = own.flatMap((feature) => {
      const version = feature.content?.snippets?.version as (path: string) => string;
      return pagesOf(cwd, feature, languages).map((page) => ({
        lang: page.lang,
        file: page.file,
        version: version(page.path),
        text: page.text,
      }));
    });
    found.push(
      ...(await checkSnippets({
        dir,
        files: (source.snippets as NonNullable<typeof source.snippets>)(dir),
        defaultLanguage,
        languages,
        versions: own.flatMap((f) => f.content?.snippets?.versions ?? []),
        pages,
        parse: mdxParser(config),
      })),
    );
  }
  return found;
}

/** `consify snippets check`, and the step of `consify build`. Returns the exit code. */
export async function runSnippetsCheck(cwd: string, quiet = false): Promise<number> {
  const config = await loadConfig(cwd);
  if (snippetFeatures(config).length === 0) {
    if (!quiet) console.log("no feature has `snippets` on: nothing to check");
    return 0;
  }
  const found = await snippetDiagnostics(cwd, config);
  for (const item of found.filter((d) => d.level === "warn")) {
    console.warn(`warning: ${item.where}: ${item.message}`);
  }
  const errors = found.filter((d) => d.level === "error");
  for (const item of errors) console.error(`error: ${item.where}: ${item.message}`);
  if (!quiet || found.length > 0) {
    console.log(
      `\nsnippets: ${errors.length} error(s), ${found.length - errors.length} warning(s)`,
    );
  }
  return errors.length > 0 ? 1 : 0;
}

/** True when the site has a feature with snippets (the build checks only then). */
export async function hasSnippets(cwd: string): Promise<boolean> {
  try {
    return snippetFeatures(await loadConfig(cwd)).length > 0;
  } catch {
    return false;
  }
}

// --- find ---

/** A fenced code block of a page. */
export interface CodeBlock {
  lang: string;
  meta: string;
  code: string;
  /** 1-based line of the opening fence. */
  line: number;
}

/** The fenced code blocks of a Markdown file, those inside a list or a component too (indented). */
export function codeBlocksOf(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const open = /^([ \t]*)(`{3,}|~{3,})[ \t]*([^\s`]*)[ \t]*(.*)$/.exec(lines[i] as string);
    if (!open) continue;
    const [, indent = "", fence = "", lang = "", meta = ""] = open;
    const body: string[] = [];
    let end = i + 1;
    for (; end < lines.length; end++) {
      const line = lines[end] as string;
      const trimmed = line.trim();
      if (trimmed.startsWith(fence[0] as string) && /^(`{3,}|~{3,})$/.test(trimmed)) {
        if (trimmed[0] === fence[0] && trimmed.length >= fence.length) break;
      }
      body.push(line.startsWith(indent) ? line.slice(indent.length) : line.trimStart());
    }
    blocks.push({ lang, meta: meta.trim(), code: body.join("\n"), line: i + 1 });
    i = end;
  }
  return blocks;
}

/** The extension of a snippet file for the language of a code block. */
const extensions: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  shell: "sh",
  shellscript: "sh",
  console: "sh",
  bash: "sh",
  zsh: "sh",
  python: "py",
  yml: "yaml",
  markdown: "md",
  "": "txt",
  text: "txt",
  plaintext: "txt",
};

/** A kebab-case word of a text: `My File.ts` → `my-file`. */
const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** The props of `<Snippet>` that give the meta of a fenced block. */
function propsOfMeta(meta: string, lang: string): string[] {
  const props: string[] = [];
  let rest = meta;
  rest = rest.replace(/(?:^|\s)title=(?:"([^"]*)"|'([^']*)')/, (_, a, b) => {
    props.push(`title="${a ?? b}"`);
    return " ";
  });
  rest = rest.replace(/(?:^|\s)\{([\d,\s-]+)\}/, (_, lines: string) => {
    props.push(`highlight="${lines.replace(/\s+/g, "")}"`);
    return " ";
  });
  for (const flag of ["twoslash", "lineNumbers", "noCopy"]) {
    rest = rest.replace(new RegExp(`(?:^|\\s)${flag}(?=\\s|$)`), () => {
      props.push(flag);
      return " ";
    });
  }
  if (rest.trim()) props.push(`meta="${rest.trim().replace(/"/g, "'")}"`);
  // a Markdown block is code here, not text to put on the page
  if (lang === "md" || lang === "mdx") props.push(`lang="${lang}"`);
  return props;
}

export interface Repeated {
  lang: string;
  code: string;
  lines: number;
  /** The folder the snippet would be in: `v1`, `WITHOUT_VERSION`. */
  version: string;
  /** Where it is: `content/en/docs/v1/a.mdx:12`. */
  places: string[];
  /** The file the snippet could be: `snippets/v1/db.ts`. */
  file: string;
  /** The tag that would replace the blocks. */
  tag: string;
}

/**
 * The code blocks of the pages that are the same, byte for byte, on two pages or more (a translation
 * is another page): every one of them could be one snippet. Blocks of `minLines` lines and more.
 */
export function findRepeated(cwd: string, config: Config, minLines = 3): Repeated[] {
  const { languages } = config.i18n;
  const dir = snippetFeatures(config)[0]?.content?.snippets?.dir ?? "snippets";
  const groups = new Map<
    string,
    Omit<Repeated, "file" | "tag"> & { metas: string[]; page: string; index: number }
  >();
  for (const feature of allFeatures(config).filter((f) => f.content)) {
    const versionOf =
      feature.content?.snippets?.version ?? feature.content?.anchors?.scope ?? (() => "");
    for (const page of pagesOf(cwd, feature, languages)) {
      codeBlocksOf(page.text).forEach((block, index) => {
        const lines = block.code.split("\n").length;
        if (lines < minLines || !block.code.trim()) return;
        const version = versionOf(page.path) || withoutVersion;
        const key = `${version}\0${block.lang}\0${block.code}`;
        const group = groups.get(key) ?? {
          lang: block.lang,
          code: block.code,
          lines,
          version,
          places: [],
          metas: [],
          page: page.path,
          index,
        };
        group.places.push(`${page.file}:${block.line}`);
        group.metas.push(block.meta);
        groups.set(key, group);
      });
    }
  }
  const taken = new Set<string>();
  return [...groups.values()]
    .filter((group) => group.places.length > 1)
    .sort((a, b) => b.places.length - a.places.length || b.lines - a.lines)
    .map(({ metas, page, index, ...group }) => {
      const meta = metas.find((m) => /title=/.test(m)) ?? metas[0] ?? "";
      const title = /title=(?:"([^"]*)"|'([^']*)')/.exec(meta);
      const base = slug((title?.[1] ?? title?.[2] ?? "").split("/").pop() ?? "");
      let id =
        base ||
        `${
          slug(
            page
              .replace(/(^|\/)index\.mdx?$/, "")
              .split("/")
              .pop() ?? "",
          ) || "page"
        }-${index + 1}`;
      for (let n = 2; taken.has(`${group.version}/${id}`); n++) id = `${base || id}-${n}`;
      taken.add(`${group.version}/${id}`);
      const extension = extensions[group.lang] ?? group.lang;
      const props = [`id="${id}"`, ...propsOfMeta(meta, group.lang)];
      return {
        ...group,
        file: `${dir}/${group.version}/${id}.${extension}`,
        tag: `<Snippet ${props.join(" ")} />`,
      };
    });
}

/** `consify snippets find`: prints the repeated code blocks. Returns the exit code. */
export async function runSnippetsFind(cwd: string, minLines: number): Promise<number> {
  const repeated = findRepeated(cwd, await loadConfig(cwd), minLines);
  for (const item of repeated) {
    console.log(`${item.file} (${item.lines} lines, ${item.places.length} places)`);
    console.log(`  ${item.tag}`);
    for (const place of item.places) console.log(`    ${place}`);
  }
  const places = repeated.reduce((sum, item) => sum + item.places.length, 0);
  console.log(
    repeated.length === 0
      ? `no code block of ${minLines} lines or more is on two pages`
      : `\n${repeated.length} repeated block(s) in ${places} places: each could be one snippet`,
  );
  return 0;
}

/** Registers `snippets check | find` on the root program. */
export function registerSnippetsCommand(program: Command): void {
  const snippets = program
    .command("snippets")
    .description("Files of snippets/<version>/ that pages put in place with <Snippet id />");
  snippets
    .command("check")
    .description("Check the <Snippet> tags of the pages and the files of the snippets")
    .action(async () => {
      process.exitCode = await runSnippetsCheck(process.cwd());
    });
  snippets
    .command("find")
    .description("List the code blocks that are the same on two pages or more (read-only)")
    .option("--min-lines <n>", "only blocks of this many lines and more", "3")
    .action(async (options: { minLines: string }) => {
      const minLines = Number.parseInt(options.minLines, 10);
      if (!Number.isInteger(minLines) || minLines < 1) {
        console.error("error: --min-lines is a whole number, 1 or more");
        process.exitCode = 1;
        return;
      }
      process.exitCode = await runSnippetsFind(process.cwd(), minLines);
    });
}
