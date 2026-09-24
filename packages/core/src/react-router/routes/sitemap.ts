import { absoluteUrl, docsivi } from "../shared.ts";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `/sitemap.xml`. Empty when `site.url` is not set (sitemaps need absolute URLs). */
export function loader() {
  const { config, source } = docsivi;
  const paths = config.site.url
    ? [
        ...source.getPages().map((page) => page.url),
        ...(config.openapi ? config.i18n.languages.map((lang) => `/${lang}/api`) : []),
      ]
    : [];
  const urls = paths.map((path) => `<url><loc>${escape(absoluteUrl(path))}</loc></url>`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
