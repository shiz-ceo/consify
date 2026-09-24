import { blog } from "docsivi:blog";
import { absoluteUrl, docsivi } from "../shared.ts";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `/sitemap.xml`. Empty when `site.url` is not set (sitemaps need absolute URLs). */
export async function loader() {
  const { config, source } = docsivi;
  const paths: string[] = config.site.url
    ? [
        ...source.getPages().map((page) => page.url),
        ...(config.openapi ? config.i18n.languages.map((lang) => `/${lang}/api`) : []),
      ]
    : [];
  if (config.site.url && config.blog && blog) {
    for (const lang of config.i18n.languages) {
      paths.push(`/${lang}/blog`);
      for (const post of await blog.posts(lang)) paths.push(`/${lang}/blog/${post.slug}`);
    }
  }
  const urls = paths.map((path) => `<url><loc>${escape(absoluteUrl(path))}</loc></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
