import { sitemapSources } from "../../../features/sitemap.ts";
import { absoluteUrl, consify } from "../../../shared/router.ts";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `/sitemap.xml`. Empty when `site.url` is not set (sitemaps need absolute URLs). */
export async function loader() {
  const paths = consify.config.site.url
    ? (await Promise.all(sitemapSources.map((source) => source()))).flat()
    : [];
  const urls = paths.map((path) => `<url><loc>${escape(absoluteUrl(path))}</loc></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
