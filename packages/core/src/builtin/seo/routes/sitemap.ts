import { siteAddresses } from "../../../feature/addresses.ts";
import { contentSource } from "../../../runtime/server.ts";
import { absoluteUrl, consify } from "../../../shared/router.ts";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `/sitemap.xml`: every page of every feature. Empty when `site.url` is not set (sitemaps need absolute URLs). */
export async function loader() {
  const pages = consify.config.site.url
    ? (await siteAddresses(consify.config, process.cwd(), contentSource)).filter(
        (a) => a.kind === "page" && !a.copy,
      )
    : [];
  const urls = [...new Set(pages.map((page) => page.url))].map(
    (path) => `<url><loc>${escape(absoluteUrl(path))}</loc></url>`,
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
