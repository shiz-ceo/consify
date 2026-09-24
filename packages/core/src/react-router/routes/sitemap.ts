import { absoluteUrl, docsivi } from "../shared.ts";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `/sitemap.xml`. Empty when `site.url` is not set (sitemaps need absolute URLs). */
export function loader() {
  const urls = docsivi.config.site.url
    ? docsivi.source
        .getPages()
        .map((page) => `<url><loc>${escape(absoluteUrl(page.url))}</loc></url>`)
    : [];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
