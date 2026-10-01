// No JSX here: this module is part of the main entry, which Node loads with `docs.config.ts`.
import type { MDXComponents } from "mdx/types";
import { type ComponentType, createContext, createElement, useContext, useMemo } from "react";
import * as runtime from "react/jsx-runtime";

/** The MDX components of the site (built-in, `mdx.components`, `custom/components`, features). */
export const MdxComponentsContext = createContext<MDXComponents>({});

type MdxContent = ComponentType<{ components?: MDXComponents }>;

/** Runs the code of `content.mdx()`: the function body MDX compiled to. */
function evaluate(code: string): MdxContent {
  // the code is the compiled MDX of the site's own content, made on its server
  const run = new Function(code) as (scope: typeof runtime) => { default: MdxContent };
  return run(runtime).default;
}

export interface MdxProps {
  /** `code` of a file read with `content.mdx()`. */
  code: string;
  /** Components for this file only, added to (or replacing) those of the site. */
  components?: MDXComponents;
  /** Classes of the wrapper: `prose` (the typography of the site) by default. */
  className?: string;
}

/**
 * Shows an MDX file read with `content.mdx()` in `load`. Every MDX component of the site is
 * available in it.
 *
 * `code` is compiled MDX, and `Mdx` runs it with `new Function`. A site with a Content-Security-Policy
 * needs `'unsafe-eval'` in `script-src`. The code is the site's own content, compiled on its server.
 *
 * @example
 * component: ({ data }) => <Mdx code={data.code} />
 */
export function Mdx({ code, components, className = "prose" }: MdxProps) {
  const site = useContext(MdxComponentsContext);
  const Content = useMemo(() => evaluate(code), [code]);
  return createElement(
    "div",
    { className },
    createElement(Content, { components: { ...site, ...components } }),
  );
}
