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
import ts from "typescript";
import type { PluggableList } from "unified";
import type { DocsConfig } from "../config/index.ts";
import { rehypeCodeHtml } from "./code-html.ts";
import { recmaHoistPopups } from "./hoist-popups.ts";
import { transformerLineRanges } from "./line-highlight.ts";
import { rehypeShikiClasses } from "./shiki-classes.ts";
import { plainText } from "./structure.ts";

/**
 * `compilerOptions` of `docs.config.ts` are the ones of a `tsconfig.json` (`target: "ES2022"`), and
 * the compiler takes them parsed (`target` is a number there), so they are converted.
 */
function tsOptions(options: Record<string, unknown>, cwd: string) {
  const { options: parsed, errors } = ts.convertCompilerOptionsFromJson(options, cwd);
  if (errors.length > 0) {
    const text = errors.map((e) => ts.flattenDiagnosticMessageText(e.messageText, "\n"));
    throw new Error(`consify: mdx.twoslash.compilerOptions: ${text.join("; ")}`);
  }
  return parsed;
}

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
      [remarkStructure, { stringify: plainText }],
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
                      ? {
                          twoslashOptions: {
                            compilerOptions: tsOptions(twoslash.compilerOptions, cwd),
                          },
                        }
                      : {}),
                    ...(twoslash.cache ? { typesCache: createFileSystemTypesCache() } : {}),
                  }),
                ]
              : []),
            ...shikiTransformers,
          ],
        },
      ],
      ...plugins.flatMap((p) => p.rehype ?? []),
      // the last ones, so a plugin of the site sees the highlighted code as the highlighter made it
      rehypeShikiClasses,
      rehypeCodeHtml,
    ],
    // the compiled page is a file the browser loads (and the HTML of the page has it too): keep it small
    recmaPlugins: [recmaHoistPopups],
  };
}
