import { join } from "node:path";
import {
  rehypeCode,
  rehypeCodeDefaultOptions,
  remarkCodeTab,
  remarkGfm,
  remarkHeading,
  remarkImage,
  remarkMdxMermaid,
  remarkNpm,
  remarkStructure,
} from "fumadocs-core/mdx-plugins";
import { transformerTwoslash } from "fumadocs-twoslash";
import { createFileSystemTypesCache } from "fumadocs-twoslash/cache-fs";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { PluggableList } from "unified";
import type { DocsConfig } from "../config/index.ts";
import { recmaHoistPopups } from "./hoist-popups.ts";
import { transformerLineRanges } from "./line-highlight.ts";
import { rehypeShikiClasses } from "./shiki-classes.ts";

export interface MdxPipeline {
  remarkPlugins: PluggableList;
  rehypePlugins: PluggableList;
  recmaPlugins: PluggableList;
}

/**
 * The MDX pipeline of the site: GitHub Markdown, headings with ids (the table of contents), code
 * tabs, package manager tabs, search data, math, Mermaid, highlighted code with Twoslash, then the
 * plugins of `mdx.plugins` in the order they are listed.
 */
export function createMdxPipeline(config: Readonly<DocsConfig>, cwd: string): MdxPipeline {
  const { math, twoslash, plugins } = config.mdx;
  const shikiTransformers = plugins.flatMap((p) => p.shiki?.transformers ?? []);
  const shikiLangs = ["js", "jsx", "ts", "tsx", ...plugins.flatMap((p) => p.shiki?.langs ?? [])];

  return {
    remarkPlugins: [
      remarkGfm,
      remarkHeading,
      // images are served from `public/`: sizes are read from there, nothing is imported
      [remarkImage, { useImport: false, publicDir: join(cwd, "public"), onError: "ignore" }],
      remarkCodeTab,
      remarkNpm,
      remarkStructure,
      remarkMdxMermaid,
      ...(math ? [remarkMath] : []),
      ...plugins.flatMap((p) => p.remark ?? []),
    ],
    rehypePlugins: [
      // KaTeX must run before the syntax highlighter
      ...(math ? [rehypeKatex] : []),
      [
        rehypeCode,
        {
          ...rehypeCodeDefaultOptions,
          // the GitHub themes with the contrast of WCAG AA for every token on the code background
          themes: { light: "github-light-high-contrast", dark: "github-dark-default" },
          // Twoslash cannot lazy-load languages inside its popups, so the common ones are preloaded
          langs: [...new Set(shikiLangs)],
          transformers: [
            ...(rehypeCodeDefaultOptions.transformers ?? []),
            transformerLineRanges,
            ...(twoslash
              ? [
                  transformerTwoslash({
                    ...(twoslash.compilerOptions
                      ? { twoslashOptions: { compilerOptions: twoslash.compilerOptions } }
                      : {}),
                    ...(twoslash.cache ? { typesCache: createFileSystemTypesCache() } : {}),
                  }),
                ]
              : []),
            ...shikiTransformers,
          ],
        },
      ],
      // after the highlighter, so it also shortens the code of the Twoslash popups
      rehypeShikiClasses,
      ...plugins.flatMap((p) => p.rehype ?? []),
    ],
    // the compiled page is sent to the browser twice (in the HTML and in `.data`): keep it small
    recmaPlugins: [recmaHoistPopups],
  };
}
