import { blog } from "docsivi:blog";
import { getMessages } from "../../../shared/messages.ts";
import { absoluteUrl, docsivi, requireLang } from "../../../shared/router.ts";
import { buildRss } from "../feed.ts";
import { categoryLabels, localized } from "../labels.ts";

/** `/{lang}/blog/rss.xml`. */
export async function loader({ params }: { params: Record<string, string | undefined> }) {
  const lang = requireLang(params);
  const { config } = docsivi;
  if (!config.blog?.rss || !blog) throw new Response("Not found", { status: 404 });

  const title = `${config.site.name}: ${localized(config, lang, config.blog.title) ?? getMessages(config, lang).blog}`;
  const xml = buildRss(await blog.posts(lang, { exact: config.i18n.fallback === "hide" }), {
    title,
    description:
      localized(config, lang, config.blog.description) ?? config.site.description ?? title,
    language: lang,
    link: absoluteUrl(`/${lang}/blog`),
    self: absoluteUrl(`/${lang}/blog/rss.xml`),
    postUrl: (post) => absoluteUrl(`/${lang}/blog/${post.slug}`),
    categoryLabels: categoryLabels(config, lang),
  });
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
