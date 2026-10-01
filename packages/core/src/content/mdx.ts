// No JSX here: this module is part of the main entry, which Node loads with `docs.config.ts`.
import type { MDXComponents } from "mdx/types";
import {
  type ComponentType,
  createContext,
  createElement,
  Suspense,
  use,
  useContext,
  useMemo,
} from "react";
import * as runtime from "react/jsx-runtime";
import { preload } from "react-dom";

/** The MDX components of the site (built-in, `mdx.components`, `custom/components`, features). */
export const MdxComponentsContext = createContext<MDXComponents>({});

type MdxContent = ComponentType<{ components?: MDXComponents }>;

/** Runs the code of `content.mdx()`: the function body MDX compiled to. */
function evaluate(code: string): MdxContent {
  // the code is the compiled MDX of the site's own content, made on its server
  const run = new Function(code) as (scope: typeof runtime) => { default: MdxContent };
  return run(runtime).default;
}

/** `code` that is not the text itself but where to get it: `mdx:<address of a file>`. */
const reference = "mdx:";

// The text of the pages the server is rendering now, by reference. The loader of a page puts it
// here and sends the browser only the reference; the render of that page, right after, reads it.
const served: Map<string, string> = ((globalThis as Record<string, unknown>).__consifyMdx ??=
  new Map()) as Map<string, string>;
const servedLimit = 64;

/** The server keeps the text of a page for the render that follows its loader. */
export function registerMdx(ref: string, code: string): void {
  served.delete(ref);
  served.set(ref, code);
  // a server answers many pages at once: the oldest text is not needed any more
  if (served.size > servedLimit) served.delete(served.keys().next().value as string);
}

// What the browser has loaded, by reference: a page is fetched once and kept.
const loaded = new Map<string, PromiseLike<MdxContent> & { status?: string; value?: MdxContent }>();

/** A thenable `use` takes without waiting: it already has its value. */
function ready(value: MdxContent): PromiseLike<MdxContent> {
  return Object.assign(Promise.resolve(value), { status: "fulfilled", value });
}

function load(ref: string): PromiseLike<MdxContent> {
  const code = served.get(ref);
  if (code !== undefined) return ready(evaluate(code));
  let page = loaded.get(ref);
  if (!page) {
    const promise: PromiseLike<MdxContent> & { status?: string; value?: MdxContent } = fetch(
      ref.slice(reference.length),
    )
      .then((response) => {
        if (!response.ok) throw new Error(`consify: ${response.status} for ${ref.slice(4)}`);
        return response.text();
      })
      .then((text) => {
        const content = evaluate(text);
        Object.assign(promise, { status: "fulfilled", value: content });
        return content;
      });
    loaded.set(ref, (page = promise));
    // a failed load is tried again at the next render
    promise.then(undefined, () => loaded.delete(ref));
  }
  return page;
}

/**
 * Loads the text of every page referenced in `data` (what a loader returned), so the page that is
 * about to be shown does not wait for it. For the `clientLoader` of a page.
 */
export async function preloadMdx(data: unknown): Promise<void> {
  const refs = new Set<string>();
  const find = (value: unknown): void => {
    if (typeof value === "string") {
      if (value.startsWith(reference)) refs.add(value);
    } else if (Array.isArray(value)) value.forEach(find);
    else if (value && typeof value === "object") Object.values(value).forEach(find);
  };
  find(data);
  await Promise.all([...refs].map((ref) => load(ref)));
}

export interface MdxProps {
  /** `code` of a file read with `content.mdx()`, or `code` of an entry. */
  code: string;
  /** Components for this file only, added to (or replacing) those of the site. */
  components?: MDXComponents;
  /** Classes of the wrapper: `prose` (the typography of the site) by default. */
  className?: string;
}

interface Inner {
  code: string;
  components: MDXComponents;
}

function Inline({ code, components }: Inner) {
  const Content = useMemo(() => evaluate(code), [code]);
  return createElement(Content, { components });
}

function Referenced({ code, components }: Inner) {
  // the HTML of the page already has the text: the browser asks for the file before it hydrates
  preload(code.slice(reference.length), { as: "fetch", crossOrigin: "anonymous" });
  return createElement(use(load(code)), { components });
}

/**
 * Shows an MDX file read with `content.mdx()` in `load`. Every MDX component of the site is
 * available in it.
 *
 * `code` is compiled MDX, and `Mdx` runs it with `new Function`. A site with a Content-Security-Policy
 * needs `'unsafe-eval'` in `script-src`. The code is the site's own content, compiled on its server.
 *
 * The `code` of an entry is only a reference to the compiled text: `Mdx` loads it (the server
 * has it at hand).
 *
 * @example
 * component: ({ data }) => <Mdx code={data.code} />
 */
export function Mdx({ code, components, className = "prose" }: MdxProps) {
  const site = useContext(MdxComponentsContext);
  const merged = { ...site, ...components };
  return createElement(
    "div",
    { className },
    code.startsWith(reference)
      ? createElement(
          Suspense,
          { fallback: null },
          createElement(Referenced, { code, components: merged }),
        )
      : createElement(Inline, { code, components: merged }),
  );
}
