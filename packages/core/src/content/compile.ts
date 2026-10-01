// MDX compiled on the server, for `<Mdx />` in the browser. No bundler involved: a page gets the
// compiled function body as text, the browser runs it with React's JSX runtime.
import { createHash } from "node:crypto";
import { compile } from "@mdx-js/mdx";
import { parse } from "yaml";
import type { DocsConfig } from "../config/index.ts";
import type { TocItem } from "../feature/types.ts";
import { createMdxPipeline, type MdxPipeline } from "../mdx/options.ts";

const frontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

/** The front matter of a Markdown file (`{}` without one) and the text after it. */
export function splitFrontmatter(source: string): { data: Record<string, unknown>; body: string } {
  const match = frontmatterPattern.exec(source);
  if (!match) return { data: {}, body: source };
  const data = parse(match[1] as string) as unknown;
  return {
    data: typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {},
    body: source.slice(match[0].length),
  };
}

export interface Compiled {
  code: string;
  toc: TocItem[];
  /** Headings and paragraphs of the page, for a search index (Fumadocs' `StructuredData`). */
  structuredData: unknown;
}

/**
 * The compiled code is printed with an indent, which is more than half of its size. It goes to the
 * browser twice per page, so the indent is dropped. A line can only start inside a template literal
 * (a quoted string cannot hold a line break), where spaces may be on purpose: code with a template
 * literal is left as it is. The backticks of the page's own text are inside quoted strings, so
 * they do not count.
 */
export function shrink(code: string): string {
  let quote = "";
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = "";
      else if (char === "\n") return code;
    } else if (char === "`") return code;
    else if (char === '"' || char === "'") quote = char;
  }
  return quote ? code : code.replace(/\n[ \t]+/g, "\n");
}

const pipelines = new WeakMap<object, MdxPipeline>();
// per config: a changed config (a new plugin in dev) is a new object, and must not reuse the old output
const caches = new WeakMap<object, Map<string, Promise<Compiled>>>();

/**
 * Compiles the body of an MDX (or `.md`) file with the pipeline of the site. The result is cached by
 * content, so a page is compiled once per change.
 */
export function compileMdx(
  config: Readonly<DocsConfig>,
  cwd: string,
  body: string,
  path: string,
): Promise<Compiled> {
  const key = createHash("sha1")
    .update(cwd)
    .update("\0")
    .update(path)
    .update("\0")
    .update(body)
    .digest("hex");
  let cache = caches.get(config);
  if (!cache) {
    cache = new Map();
    caches.set(config, cache);
  }
  let compiled = cache.get(key);
  if (!compiled) {
    const all = cache;
    let pipeline = pipelines.get(config);
    if (!pipeline) {
      pipeline = createMdxPipeline(config, cwd);
      pipelines.set(config, pipeline);
    }
    compiled = compile(
      { value: body, path },
      {
        outputFormat: "function-body",
        format: path.endsWith(".md") ? "md" : "mdx",
        development: false,
        ...pipeline,
      },
    ).then((file) => ({
      code: shrink(String(file)),
      toc: ((file.data as { toc?: TocItem[] }).toc ?? []).map(({ title, url, depth }) => ({
        title: typeof title === "string" ? title : String(title),
        url,
        depth,
      })),
      structuredData: (file.data as { structuredData?: unknown }).structuredData,
    }));
    // a file that fails is compiled again next time, after it is fixed
    compiled.catch(() => all.delete(key));
    cache.set(key, compiled);
    // while a site is edited every save adds a version: keep the recent ones
    if (all.size > 1000) all.delete(all.keys().next().value as string);
  }
  return compiled;
}
