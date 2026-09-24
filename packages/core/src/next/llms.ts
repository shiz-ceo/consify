import type { Docsivi } from "../instance.ts";

type LangContext = { params: Promise<{ lang: string }> };

/**
 * Route handlers for `/{lang}/llms.txt` (index) and `/{lang}/llms-full.txt` (all pages).
 * They live under `[lang]` because the language proxy redirects unprefixed paths.
 * Requires `postprocess: { includeProcessedMarkdown: true }` in the project's `defineDocs()`.
 */
export function createLlmsRoutes({ config, docsLlms, i18n }: Docsivi) {
  const respond =
    (build: (lang: string) => Promise<string>) => async (_: Request, ctx: LangContext) => {
      if (!config.features.llmsTxt) return new Response("Not found", { status: 404 });
      const { lang } = await ctx.params;
      return new Response(await build(lang), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    };

  return {
    index: respond((lang) => docsLlms.index(lang)),
    full: respond((lang) => docsLlms.full(lang)),
    generateStaticParams: () => i18n.languages.map((lang) => ({ lang })),
  };
}
