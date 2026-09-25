import { consify, requireLang } from "../../../shared/router.ts";

/** `/{lang}/llms.txt`: index of all pages for LLMs and AI agents. */
export async function loader({ params }: { params: Record<string, string | undefined> }) {
  const lang = requireLang(params);
  if (!consify.config.features.llmsTxt) throw new Response("Not found", { status: 404 });
  return new Response(await consify.docsLlms.index(lang), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
