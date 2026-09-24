import { rehypeCodeDefaultOptions, remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import type { GlobalConfig } from "fumadocs-mdx/config";
import { transformerTwoslash } from "fumadocs-twoslash";
import { createFileSystemTypesCache } from "fumadocs-twoslash/cache-fs";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import type { DocsConfig } from "../config/index.ts";

type MdxOptions = NonNullable<GlobalConfig["mdxOptions"]>;

/**
 * Builds the MDX pipeline from the config: built-in behavior (code blocks, Twoslash, math,
 * Mermaid) first, then plugins from `docs.config.ts` in the order they are listed.
 * Each built-in is switched by `features`.
 */
export function createMdxOptions(config: Readonly<DocsConfig>): MdxOptions {
  const { features, twoslash, plugins } = config;

  const shikiTransformers = plugins.flatMap((p) => p.shiki?.transformers ?? []);
  const shikiLangs = ["js", "jsx", "ts", "tsx", ...plugins.flatMap((p) => p.shiki?.langs ?? [])];

  return {
    remarkPlugins: [
      remarkMdxMermaid,
      ...(features.math ? [remarkMath] : []),
      ...plugins.flatMap((p) => p.remark ?? []),
    ],
    // KaTeX must run before the syntax highlighter.
    rehypePlugins: (defaults) => [
      ...(features.math ? [rehypeKatex] : []),
      ...defaults,
      ...plugins.flatMap((p) => p.rehype ?? []),
    ],
    rehypeCodeOptions: {
      themes: { light: "github-light", dark: "github-dark" },
      // Twoslash only handles blocks marked `twoslash`. Shiki cannot lazy-load languages inside
      // Twoslash popups, so the common ones are preloaded.
      langs: [...new Set(shikiLangs)],
      transformers: [
        ...(rehypeCodeDefaultOptions.transformers ?? []),
        ...(features.twoslash
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
  } as MdxOptions;
}
