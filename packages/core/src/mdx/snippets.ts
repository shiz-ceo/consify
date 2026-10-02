// Snippets: a file of `snippets/<version>/` shared by the pages of every language, put on a page with
// `<Snippet id="db/connect" />`. The tag is replaced before anything else of the pipeline runs: a code
// file becomes a code block (highlighted, Twoslash, the notations in its comments), an `.mdx` file
// becomes the nodes of its text (its components and code blocks go through the pipeline as the page's
// own). No file system here: the files come from `SnippetFiles`, so the server bundle can hold them.
import { withoutVersion } from "../content/snippet-rules.ts";

/** The folder of the snippets. */
export interface SnippetFiles {
  /** Every file of the folder, relative to it, with `/`: `v1/db/connect.ts`. */
  list(): readonly string[];
  /** The text of a file, by its path in the folder. */
  read(path: string): Promise<string>;
}

/** The page a snippet is put on. */
export interface SnippetPlace {
  lang: string;
  /** The version of the page, `""` when it has none (the folder `WITHOUT_VERSION`). */
  version: string;
  defaultLanguage: string;
  languages: readonly string[];
}

interface Point {
  line: number;
  column: number;
  offset?: number | undefined;
}

interface EstreeNode {
  type: string;
  loc?: { start: { line: number } } | null;
  [key: string]: unknown;
}

interface Attribute {
  type: string;
  name?: string;
  value?: string | null | { type: string; value: string };
}

/** An mdast node, as much of it as is read here. */
export interface SnippetNode {
  type: string;
  name?: string | null;
  value?: string;
  lang?: string | null;
  meta?: string | null;
  attributes?: Attribute[];
  children?: SnippetNode[];
  data?: { estree?: { type: string; body: EstreeNode[] } | null; [key: string]: unknown };
  position?: { start: Point; end: Point } | undefined;
}

/** A tag that cannot be replaced: where it is (the page, or the snippet with a nested tag) and why. */
export interface SnippetProblem {
  file: string;
  line: number | undefined;
  message: string;
}

// --- the files ---

/** Files that are parsed as Markdown and put on the page as text; any other file is code. */
const textExtensions = new Set(["mdx", "md"]);

/** The extension of a file, without the dot: `ts`. */
export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** A snippet that goes to the page as text (`.mdx`, `.md`), not as code. */
export const isTextSnippet = (path: string) => textExtensions.has(extensionOf(path));

/** The extensions whose language has another name for the highlighter. */
const languages: Record<string, string> = {
  mjs: "js",
  cjs: "js",
  mts: "ts",
  cts: "ts",
  txt: "text",
};

/** The language of the code block of a file: its extension, `mjs` → `js`, `mts` → `ts`. */
export function languageOf(path: string): string {
  const extension = extensionOf(path);
  return languages[extension] ?? (extension || "text");
}

/** `db/connect#open` → the id `db/connect` and the region `open`. */
export function splitId(raw: string): { id: string; region: string | undefined } {
  const at = raw.indexOf("#");
  return at < 0
    ? { id: raw, region: undefined }
    : { id: raw.slice(0, at), region: raw.slice(at + 1) };
}

/** Why `id` cannot be the id of a snippet, `undefined` when it can. */
export function idProblem(id: string, languageCodes: readonly string[]): string | undefined {
  if (!id) return "the id is empty";
  const parts = id.split("/");
  if (parts.some((part) => !part || part === "." || part === "..") || id.includes("\\")) {
    return `the id "${id}" is not a path inside the folder of the version (no "..", no empty parts)`;
  }
  const first = parts[0] as string;
  if (languageCodes.includes(first)) {
    return `the id "${id}" starts with "${first}", the folder of a language: the id never has the language in it`;
  }
  return undefined;
}

export interface Resolved {
  /** The file, by its path in the folder of the snippets. */
  path: string | undefined;
  /** Where it was looked for, in order: `v1/ru/db/connect.*`. */
  tried: string[];
  /** Two files have the id (`connect.ts` and `connect.js`). */
  error?: string;
}

/**
 * The file of a snippet for a page: the variant of the language of the page
 * (`<version>/<lang>/<id>.*`), then the file of every language (`<version>/<id>.*`), then the variant
 * of the default language.
 */
export function resolveSnippet(
  files: readonly string[],
  id: string,
  place: SnippetPlace,
  version: string = place.version,
): Resolved {
  const folder = version || withoutVersion;
  const dirs = [
    ...new Set([`${folder}/${place.lang}`, folder, `${folder}/${place.defaultLanguage}`]),
  ];
  const tried: string[] = [];
  for (const dir of dirs) {
    const prefix = `${dir}/${id}.`;
    tried.push(`${prefix}*`);
    const found = files.filter(
      (file) => file.startsWith(prefix) && /^[^./]+$/.test(file.slice(prefix.length)),
    );
    if (found.length > 1) {
      return { path: undefined, tried, error: `several files have this id: ${found.join(", ")}` };
    }
    if (found[0]) return { path: found[0], tried };
  }
  return { path: undefined, tried };
}

// --- regions ---

const marker = (word: string) =>
  new RegExp(`^\\s*(?:(?://|#|--|;|<!--|/\\*|\\{/\\*)\\s*)?#${word}\\b[ \\t]*([\\w.-]*)`);
const regionStart = marker("region");
const regionEnd = marker("endregion");

/** The lines without the indent they all have. */
function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((line) => line.trim())
    .map((line) => (/^[ \t]*/.exec(line) as RegExpExecArray)[0].length);
  const indent = indents.length > 0 ? Math.min(...indents) : 0;
  return indent > 0 ? lines.map((line) => line.slice(indent)) : lines;
}

/**
 * The code of a file, or of a region of it: the lines between `// #region name` and its
 * `// #endregion` (`# #region`, `<!-- #region -->` and `/* #region *\/` too), without their common
 * indent. The lines of the markers themselves are never shown.
 */
export function regionOf(
  text: string,
  name: string | undefined,
): { code: string } | { error: string } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let from = 0;
  let to = lines.length;
  if (name !== undefined) {
    const start = lines.findIndex((line) => regionStart.exec(line)?.[1] === name);
    if (start < 0) return { error: `there is no region "${name}" (\`// #region ${name}\`)` };
    let depth = 0;
    let end = -1;
    for (let i = start + 1; i < lines.length; i++) {
      const line = lines[i] as string;
      if (regionStart.test(line)) depth++;
      else if (regionEnd.test(line)) {
        if (depth === 0) {
          end = i;
          break;
        }
        depth--;
      }
    }
    if (end < 0) return { error: `the region "${name}" has no \`#endregion\`` };
    from = start + 1;
    to = end;
  }
  const kept = lines.slice(from, to).filter((l) => !regionStart.test(l) && !regionEnd.test(l));
  const code = (name === undefined ? kept : dedent(kept)).join("\n");
  return { code: code.replace(/^\n+/, "").replace(/\s+$/, "") };
}

// --- the props ---

/** What `<Snippet>` takes: `id` and `version` for every snippet, the rest for code. */
export interface SnippetProps {
  id: string;
  version?: string | undefined;
  title?: string | undefined;
  twoslash?: boolean | undefined;
  highlight?: string | undefined;
  lineNumbers?: boolean | number | undefined;
  noCopy?: boolean | undefined;
  lang?: string | undefined;
  meta?: string | undefined;
}

const kinds: Record<keyof SnippetProps, "string" | "boolean" | "lines"> = {
  id: "string",
  version: "string",
  title: "string",
  twoslash: "boolean",
  highlight: "string",
  lineNumbers: "lines",
  noCopy: "boolean",
  lang: "string",
  meta: "string",
};
const codeOnly = ["title", "twoslash", "highlight", "lineNumbers", "noCopy", "lang", "meta"];

/** A literal of an expression (`{true}`, `{3}`, `{"a"}`), `undefined` for anything else. */
function literal(expression: string): string | number | boolean | undefined {
  const text = expression.trim();
  if (text === "true") return true;
  if (text === "false") return false;
  if (/^\d+$/.test(text)) return Number(text);
  const quoted = /^(["'`])([^]*)\1$/.exec(text);
  return quoted ? (quoted[2] as string) : undefined;
}

const expected = {
  string: 'a text: name="value"',
  boolean: "true or false: `name` or `name={false}`",
  lines: "true or the number of the first line: `name` or `name={10}`",
};

/** The props of a `<Snippet>` tag, or what is wrong with them. */
export function snippetProps(node: SnippetNode): { props?: SnippetProps; errors: string[] } {
  const errors: string[] = [];
  const props: Record<string, unknown> = {};
  for (const attribute of node.attributes ?? []) {
    if (attribute.type !== "mdxJsxAttribute" || !attribute.name) {
      errors.push('`{...props}` is not read: write every prop of `<Snippet>` as name="value"');
      continue;
    }
    const name = attribute.name;
    const kind = kinds[name as keyof SnippetProps];
    if (!kind) {
      errors.push(`\`<Snippet>\` has no prop "${name}" (it has ${Object.keys(kinds).join(", ")})`);
      continue;
    }
    const raw = attribute.value;
    const value =
      raw === null || raw === undefined ? true : typeof raw === "string" ? raw : literal(raw.value);
    const fits =
      (kind === "string" && typeof value === "string") ||
      (kind === "boolean" && typeof value === "boolean") ||
      (kind === "lines" && (typeof value === "boolean" || typeof value === "number"));
    if (!fits) {
      errors.push(`"${name}" of \`<Snippet>\` is ${expected[kind]}`);
      continue;
    }
    props[name] = value;
  }
  if (typeof props.id !== "string") {
    errors.push('`<Snippet>` needs an id: `<Snippet id="db/connect" />`');
  }
  const lines = /^\s*\d+(-\d+)?(\s*,\s*\d+(-\d+)?)*\s*$/;
  if (typeof props.highlight === "string" && !lines.test(props.highlight)) {
    errors.push(`highlight="${props.highlight}" is not a list of lines: highlight="2,4-5"`);
  }
  return errors.length > 0 ? { errors } : { props: props as unknown as SnippetProps, errors };
}

/**
 * The meta of the code block of a snippet, as it is written after the language of a fenced block:
 * `title="db.ts" {2,4-5} lineNumbers twoslash`, then `meta` as it is.
 */
export function codeMeta(props: Omit<SnippetProps, "id">): string {
  const parts: string[] = [];
  if (props.title !== undefined) {
    parts.push(props.title.includes('"') ? `title='${props.title}'` : `title="${props.title}"`);
  }
  if (props.highlight) parts.push(`{${props.highlight.replace(/\s+/g, "")}}`);
  if (props.lineNumbers === true) parts.push("lineNumbers");
  else if (typeof props.lineNumbers === "number") parts.push(`lineNumbers=${props.lineNumbers}`);
  if (props.noCopy) parts.push("noCopy");
  if (props.twoslash) parts.push("twoslash");
  if (props.meta?.trim()) parts.push(props.meta.trim());
  return parts.join(" ");
}

// --- the tags ---

export const isSnippetTag = (node: SnippetNode) =>
  (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
  node.name === "Snippet";

/** What a tag stands for: a code block, or the text of an `.mdx` file. */
type Loaded =
  | { kind: "code"; path: string; lang: string; meta: string; value: string }
  | { kind: "text"; path: string; text: string }
  | { kind: "problem"; message: string };

export interface SnippetContext {
  files: SnippetFiles;
  place: SnippetPlace;
  /** The folder of the snippets, for the messages: `snippets`. */
  dir: string;
}

/** Reads the file a tag names. `stack` is the snippets the tag is inside of (a loop is a problem). */
async function load(
  node: SnippetNode,
  context: SnippetContext,
  list: readonly string[],
  stack: readonly string[],
): Promise<Loaded> {
  const problem = (message: string): Loaded => ({ kind: "problem", message });
  if (node.type === "mdxJsxTextElement") {
    return problem("`<Snippet>` is a block: put it on a line of its own, not inside a sentence");
  }
  if (node.children && node.children.length > 0) {
    return problem('`<Snippet>` has no children: `<Snippet id="…" />`');
  }
  const { props, errors } = snippetProps(node);
  if (!props) return problem(errors.join("; "));
  const { id, region } = splitId(props.id);
  const wrong = idProblem(id, context.place.languages);
  if (wrong) return problem(wrong);
  const resolved = resolveSnippet(list, id, context.place, props.version ?? context.place.version);
  if (resolved.error) return problem(`snippet "${id}": ${resolved.error}`);
  if (!resolved.path) {
    const tried = resolved.tried.map((t) => `${context.dir}/${t}`).join(", ");
    return problem(`snippet "${id}" not found: tried ${tried}`);
  }
  const path = resolved.path;
  const shown = `${context.dir}/${path}`;
  if (stack.includes(path)) {
    const loop = [...stack, path].map((p) => `${context.dir}/${p}`).join(" → ");
    return problem(`snippets include each other: ${loop}`);
  }
  let text: string;
  try {
    text = (await context.files.read(path)).replace(/\r\n?/g, "\n");
  } catch (error) {
    return problem(`${shown}: ${(error as Error).message}`);
  }
  if (props.lang !== undefined || !isTextSnippet(path)) {
    const taken = regionOf(text, region);
    if ("error" in taken) return problem(`${shown}: ${taken.error}`);
    return {
      kind: "code",
      path,
      lang: props.lang ?? languageOf(path),
      meta: codeMeta(props),
      value: taken.code,
    };
  }
  const extra = codeOnly.filter((name) => name in props);
  if (extra.length > 0) {
    return problem(`${extra.join(", ")}: only for a code snippet, and ${shown} is a text one`);
  }
  if (region !== undefined) {
    return problem(`#${region}: a region is only for a code snippet, and ${shown} is a text one`);
  }
  if (/^---[ \t]*\n/.test(text)) {
    return problem(
      `${shown}: a snippet has no front matter (remove the block between the \`---\` lines)`,
    );
  }
  return { kind: "text", path, text };
}

/** The names an `import` declares: local name → `source#imported`. */
function importsOf(statement: EstreeNode): [string, string][] {
  const source = String((statement.source as { value: unknown }).value);
  return (statement.specifiers as EstreeNode[]).map((specifier) => {
    const local = (specifier.local as { name: string }).name;
    const imported = specifier.imported as { name?: string; value?: string } | undefined;
    const name =
      specifier.type === "ImportDefaultSpecifier"
        ? "default"
        : specifier.type === "ImportNamespaceSpecifier"
          ? "*"
          : String(imported?.name ?? imported?.value);
    return [local, `${source}#${name}`];
  });
}

export interface ExpandOptions extends SnippetContext {
  /** The page, for the messages. */
  page: string;
  /** Parses the text of an `.mdx` snippet into mdast, the way the page is parsed. */
  parse(text: string): SnippetNode;
}

export interface Expansion {
  problems: SnippetProblem[];
  /** The files that were put on the page, by their path in the folder of the snippets. */
  used: Set<string>;
}

const headingMessage =
  "a heading in a snippet: write the headings on the page (their ids are in its anchors registry), the snippet goes under it";

/**
 * Replaces every `<Snippet>` of a page (an mdast tree) with what it names, nested snippets too. The
 * `import` lines of a text snippet go to the top of the page; one that declares a name the page has
 * for something else is a problem, the same import twice is kept once. A heading in a snippet is a
 * problem too: the headings of a page, and their ids, are written on the page.
 */
export async function expandSnippets(
  tree: SnippetNode,
  options: ExpandOptions,
): Promise<Expansion> {
  const list = options.files.list();
  const problems: SnippetProblem[] = [];
  const used = new Set<string>();
  const declared = new Map<string, string>();
  const hoisted: SnippetNode[] = [];

  for (const node of tree.children ?? []) {
    if (node.type !== "mdxjsEsm") continue;
    for (const statement of node.data?.estree?.body ?? []) {
      if (statement.type !== "ImportDeclaration") continue;
      for (const [name, what] of importsOf(statement)) declared.set(name, what);
    }
  }

  const hoist = (esm: SnippetNode, file: string) => {
    const program = esm.data?.estree;
    if (!program) return;
    const body: EstreeNode[] = [];
    for (const statement of program.body) {
      const line = statement.loc?.start.line;
      if (statement.type !== "ImportDeclaration") {
        const message = "a snippet has no `export`: only its `import` lines go to the page";
        problems.push({ file, line, message });
        continue;
      }
      const all = importsOf(statement);
      const kept = (statement.specifiers as EstreeNode[]).filter((_, index) => {
        const [name, what] = all[index] as [string, string];
        const before = declared.get(name);
        if (before === undefined) {
          declared.set(name, what);
          return true;
        }
        if (before !== what) {
          const said = (text: string) => text.replace("#", " ");
          problems.push({
            file,
            line,
            message: `the import "${name}" (${said(what)}) conflicts with "${name}" of the page (${said(before)}): rename one of them`,
          });
        }
        return false;
      });
      if (all.length > 0 && kept.length === 0) continue;
      body.push(kept.length === all.length ? statement : { ...statement, specifiers: kept });
    }
    if (body.length > 0) {
      hoisted.push({ ...esm, data: { ...esm.data, estree: { ...program, body } } });
    }
  };

  const headings = (parent: SnippetNode, file: string) => {
    for (const child of parent.children ?? []) {
      if (child.type === "heading") {
        problems.push({ file, line: child.position?.start.line, message: headingMessage });
      }
      headings(child, file);
    }
  };

  const expand = async (
    node: SnippetNode,
    file: string,
    stack: string[],
  ): Promise<SnippetNode[]> => {
    const line = node.position?.start.line;
    const loaded = await load(node, options, list, stack);
    if (loaded.kind === "problem") {
      problems.push({ file, line, message: loaded.message });
      return [];
    }
    used.add(loaded.path);
    if (loaded.kind === "code") {
      const { lang, meta, value } = loaded;
      return [{ type: "code", lang, meta: meta || null, value, position: node.position }];
    }
    const shown = `${options.dir}/${loaded.path}`;
    let parsed: SnippetNode;
    try {
      parsed = options.parse(loaded.text);
    } catch (error) {
      problems.push({ file: shown, line: undefined, message: (error as Error).message });
      return [];
    }
    headings(parsed, shown);
    const holder: SnippetNode = { type: "root", children: [] };
    for (const child of parsed.children ?? []) {
      if (child.type === "mdxjsEsm") hoist(child, shown);
      else holder.children?.push(child);
    }
    await walk(holder, shown, [...stack, loaded.path]);
    return holder.children ?? [];
  };

  const walk = async (parent: SnippetNode, file: string, stack: string[]): Promise<void> => {
    const children = parent.children;
    if (!children) return;
    for (let i = 0; i < children.length; i++) {
      const node = children[i] as SnippetNode;
      if (isSnippetTag(node)) {
        const nodes = await expand(node, file, stack);
        children.splice(i, 1, ...nodes);
        i += nodes.length - 1;
        continue;
      }
      await walk(node, file, stack);
    }
  };

  await walk(tree, options.page, []);
  if (hoisted.length > 0) tree.children?.unshift(...hoisted);
  return { problems, used };
}

/** A fence for `code` that no line of it closes. */
function fenceFor(code: string): string {
  const runs = [...code.matchAll(/^\s*(`{3,})/gm)].map((m) => (m[1] as string).length);
  return "`".repeat(Math.max(2, ...runs) + 1);
}

/**
 * The Markdown of a page with every `<Snippet>` replaced by its text (a code snippet as a fenced
 * block, a text one without its `import` lines): what `llms.txt` and the link cards are made of. A tag
 * that cannot be replaced is left as it is (the compiled page says why).
 */
export async function expandSnippetsText(
  text: string,
  options: SnippetContext & { parse(text: string): SnippetNode },
  stack: readonly string[] = [],
): Promise<string> {
  if (!text.includes("<Snippet") && stack.length === 0) return text;
  let tree: SnippetNode;
  try {
    tree = options.parse(text);
  } catch {
    return text;
  }
  const tags: SnippetNode[] = [];
  const esm: SnippetNode[] = [];
  const find = (parent: SnippetNode) => {
    for (const child of parent.children ?? []) {
      if (child.type === "mdxjsEsm") esm.push(child);
      else if (isSnippetTag(child)) tags.push(child);
      else find(child);
    }
  };
  find(tree);
  const list = options.files.list();
  const edits: { from: number; to: number; text: string }[] = [];
  // the imports of a snippet are code of the page, not its text
  for (const node of stack.length > 0 ? esm : []) {
    const { start, end } = node.position ?? {};
    if (start?.offset !== undefined && end?.offset !== undefined) {
      edits.push({ from: start.offset, to: end.offset, text: "" });
    }
  }
  for (const node of tags) {
    const { start, end } = node.position ?? {};
    if (start?.offset === undefined || end?.offset === undefined) continue;
    const loaded = await load(node, options, list, stack);
    if (loaded.kind === "problem") continue;
    let inserted: string;
    if (loaded.kind === "code") {
      const fence = fenceFor(loaded.value);
      const info = `${loaded.lang}${loaded.meta ? ` ${loaded.meta}` : ""}`;
      inserted = `${fence}${info}\n${loaded.value}\n${fence}`;
    } else {
      const nested = await expandSnippetsText(loaded.text, options, [...stack, loaded.path]);
      inserted = nested.trim();
    }
    // the lines after the first one start where the tag starts: inside a list, a component
    const indent = " ".repeat(start.column - 1);
    edits.push({
      from: start.offset,
      to: end.offset,
      text: inserted.split("\n").join(`\n${indent}`),
    });
  }
  let out = text;
  for (const edit of edits.sort((a, b) => b.from - a.from)) {
    out = out.slice(0, edit.from) + edit.text + out.slice(edit.to);
  }
  return out;
}

// --- the plugin ---

/** What `compileMdx` says about the page it compiles (`file.data.snippets`): there are snippets. */
export interface SnippetsData {
  files: SnippetFiles;
  /** The folder of the snippets, for the messages. */
  dir: string;
  lang: string;
  version: string;
}

export interface RemarkSnippetsOptions {
  defaultLanguage: string;
  languages: readonly string[];
  /** The site has a component `Snippet` of its own: with snippets off, the tag is left to it. */
  ownComponent: boolean;
}

interface Parser {
  parse(text: string): unknown;
}

interface File {
  path?: string;
  data: Record<string, unknown>;
}

const where = (problem: SnippetProblem) =>
  `${problem.file}${problem.line === undefined ? "" : `:${problem.line}`}: ${problem.message}`;

/**
 * The remark plugin of `<Snippet>`: the first one of the pipeline, so what a snippet brings is
 * highlighted, gets ids, goes to the search and to the table of contents as the page's own text.
 * A tag that cannot be replaced stops the page with every reason.
 */
export function remarkSnippets(this: Parser, options: RemarkSnippetsOptions) {
  const processor = this;
  return async (tree: SnippetNode, file: File) => {
    const data = file.data.snippets as SnippetsData | undefined;
    const page = file.path ?? "the page";
    if (!data) {
      if (options.ownComponent) return;
      let tag: SnippetNode | undefined;
      const find = (node: SnippetNode) => {
        for (const child of node.children ?? []) {
          if (tag) return;
          if (isSnippetTag(child)) tag = child;
          else find(child);
        }
      };
      find(tree);
      if (tag) {
        const line = tag.position?.start.line;
        throw new Error(
          `${page}${line === undefined ? "" : `:${line}`}: <Snippet> needs the snippets on: \`docs({ snippets: true })\` in docs.config.ts (the files are in snippets/<version>/)`,
        );
      }
      return;
    }
    const { problems } = await expandSnippets(tree, {
      files: data.files,
      dir: data.dir,
      page,
      place: {
        lang: data.lang,
        version: data.version,
        defaultLanguage: options.defaultLanguage,
        languages: options.languages,
      },
      parse: (text) => processor.parse(text) as SnippetNode,
    });
    if (problems.length > 0) throw new Error(problems.map(where).join("\n"));
  };
}
