import { absoluteUrl, consify } from "../../../shared/router.ts";

/** `/robots.txt`. */
export function loader() {
  const lines = ["User-agent: *", "Allow: /"];
  if (consify.config.site.url) lines.push("", `Sitemap: ${absoluteUrl("/sitemap.xml")}`);
  return new Response(`${lines.join("\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
