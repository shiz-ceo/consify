import { docsivi, requireLang } from "../shared.ts";

/** `/{lang}/llms.txt`: index of all pages for LLMs and AI agents. */
export async function loader({ params }: { params: Record<string, string | undefined> }) {
  const lang = requireLang(params);
  if (!docsivi.config.features.llmsTxt) throw new Response("Not found", { status: 404 });
  return new Response(await docsivi.docsLlms.index(lang), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
