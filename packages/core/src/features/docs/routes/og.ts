import { generateOGImage } from "fumadocs-ui/og/takumi";
import { docsivi, requireLang } from "../../../shared/router.ts";

/** `/{lang}/og/{...slugs}/image.png`: Open Graph image of a page. */
export async function loader({ params }: { params: Record<string, string | undefined> }) {
  const lang = requireLang(params);
  const slugs = (params["*"] ?? "").split("/").filter(Boolean).slice(0, -1);
  const page = docsivi.source.getPage(slugs, lang);
  if (!page || !docsivi.config.features.og) throw new Response("Not found", { status: 404 });
  return generateOGImage({
    title: page.data.title,
    description: page.data.description,
    site: docsivi.config.site.name,
    format: "png",
  });
}
