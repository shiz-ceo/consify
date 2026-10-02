// The snippets of a site on the server: the parser of their text, and the checks of `consify check`
// (`consify snippets check`). The expansion itself is in mdx/snippets.ts.
import { createProcessor } from "@mdx-js/mdx";
import { remarkGfm } from "fumadocs-core/mdx-plugins";
import remarkMath from "remark-math";
import type { DocsConfig } from "../config/index.ts";
import {
  expandSnippets,
  extensionOf,
  isTextSnippet,
  type SnippetFiles,
  type SnippetNode,
} from "../mdx/snippets.ts";
import { withoutVersion } from "./snippet-rules.ts";

export {
  type SnippetsConfig,
  type SnippetsOptions,
  snippetsDir,
  withoutVersion,
} from "./snippet-rules.ts";

const parsers = new WeakMap<object, (text: string) => SnippetNode>();

/**
 * Parses MDX into mdast the way a page is parsed (GitHub Markdown, math when it is on), without
 * compiling it: for the checks and for the text of `llms.txt`.
 */
export function mdxParser(config: Readonly<DocsConfig>): (text: string) => SnippetNode {
  let parse = parsers.get(config);
  if (!parse) {
    const processor = createProcessor({
      format: "mdx",
      remarkPlugins: [remarkGfm, ...(config.mdx.math ? [remarkMath] : [])],
    });
    parse = (text) => processor.parse(text) as unknown as SnippetNode;
    parsers.set(config, parse);
  }
  return parse;
}

/** Comments to the end of the line in these languages start with `#`, not with `//`. */
const hashComments = new Set([
  "sh",
  "bash",
  "zsh",
  "fish",
  "py",
  "rb",
  "r",
  "pl",
  "yaml",
  "yml",
  "toml",
  "ini",
  "conf",
  "env",
  "ps1",
  "dockerfile",
  "mk",
]);

/**
 * The code of a file without its comments and blank lines, to compare the variants of a snippet in
 * two languages. Simple on purpose: `/* *\/`, `<!-- -->` and line comments (`//`, or `#` in shell,
 * Python, YAML…) after a space or at the start of a line; a `//` inside a string after a space is
 * taken for a comment too.
 */
export function withoutComments(code: string, extension: string): string {
  const text = code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(hashComments.has(extension) ? /(^|\s)#(?!!).*$/gm : /(^|\s)\/\/.*$/gm, "$1");
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
    .join("\n");
}

/** A page of a feature with snippets on, for the check. */
export interface SnippetPage {
  lang: string;
  /** The file, for the messages: `content/en/docs/v1/guide.mdx`. */
  file: string;
  /** The version of the page, `""` when it has none. */
  version: string;
  text: string;
}

export interface SnippetsInput {
  /** The folder of the snippets, for the messages: `snippets`. */
  dir: string;
  files: SnippetFiles;
  defaultLanguage: string;
  languages: readonly string[];
  /** The versions of the features that use this folder: the names its folders may have. */
  versions: readonly string[];
  pages: SnippetPage[];
  parse(text: string): SnippetNode;
}

export interface SnippetDiagnostic {
  level: "error" | "warn";
  /** The file (`content/en/docs/v1/guide.mdx:12`, `snippets/v1/db.ts`) the message is about. */
  where: string;
  message: string;
}

/** The text of a page with its front matter made blank lines: the lines keep their numbers. */
const blankFrontmatter = (text: string) =>
  text.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?=\r?\n|$)/, (block) =>
    block.replace(/[^\n]/g, ""),
  );

/**
 * Checks the snippets of a folder against the pages that use them: every `<Snippet>` names a file
 * that exists (with its region), the snippets do not include each other in a loop, have no headings
 * and no import that conflicts with the page; the folders are versions; a file no page uses, and two
 * language variants of a code snippet that differ in more than their comments, are warnings.
 */
export async function checkSnippets(input: SnippetsInput): Promise<SnippetDiagnostic[]> {
  const { dir, files, defaultLanguage, languages, versions, pages, parse } = input;
  const out: SnippetDiagnostic[] = [];
  const said = new Set<string>();
  const add = (level: SnippetDiagnostic["level"], where: string, message: string) => {
    const key = `${level}\0${where}\0${message}`;
    if (said.has(key)) return;
    said.add(key);
    out.push({ level, where, message });
  };
  const used = new Set<string>();

  for (const page of pages) {
    if (!page.text.includes("<Snippet")) continue;
    let tree: SnippetNode;
    try {
      tree = parse(blankFrontmatter(page.text));
    } catch {
      // a page that is not valid MDX: its build says so
      continue;
    }
    const found = await expandSnippets(tree, {
      files,
      dir,
      page: page.file,
      place: { lang: page.lang, version: page.version, defaultLanguage, languages },
      parse,
    });
    for (const path of found.used) used.add(path);
    for (const problem of found.problems) {
      add("error", `${problem.file}${problem.line ? `:${problem.line}` : ""}`, problem.message);
    }
  }

  const folders = new Set([...versions, withoutVersion]);
  const variants = new Map<string, string[]>();
  for (const path of files.list()) {
    const [folder = "", ...rest] = path.split("/");
    const where = `${dir}/${path}`;
    if (rest.length === 0) {
      add("error", where, `a snippet is in the folder of a version: ${dir}/<version>/${folder}`);
      continue;
    }
    if (!folders.has(folder)) {
      add(
        "error",
        where,
        `"${folder}" is not a version of the docs (${[...folders].join(", ")}): the folders of ${dir}/ are the versions`,
      );
      continue;
    }
    const inLanguage = rest.length > 1 && languages.includes(rest[0] as string);
    const idPath = (inLanguage ? rest.slice(1) : rest).join("/");
    if (!inLanguage && rest.length === 1 && languages.includes(idPath.replace(/\.[^.]*$/, ""))) {
      add("error", where, "the id of a snippet is never the code of a language: rename the file");
      continue;
    }
    if (!used.has(path)) add("warn", where, "no page uses this snippet");
    if (!isTextSnippet(path)) {
      const key = `${folder}/${idPath}`;
      variants.set(key, [...(variants.get(key) ?? []), path]);
    }
  }

  // the variants of a code snippet in other languages differ in their comments only
  for (const paths of variants.values()) {
    if (paths.length < 2) continue;
    const texts = await Promise.all(paths.map((path) => files.read(path)));
    const [first, ...others] = paths.map((path, i) =>
      withoutComments((texts[i] as string).replace(/\r\n?/g, "\n"), extensionOf(path)),
    );
    others.forEach((code, i) => {
      if (code !== first) {
        add(
          "warn",
          `${dir}/${paths[i + 1]}`,
          `the code differs from ${dir}/${paths[0]} in more than the comments (the language variants of a snippet translate its comments only)`,
        );
      }
    });
  }
  return out;
}
