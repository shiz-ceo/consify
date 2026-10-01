/**
 * A short, URL/filename/Docker-service-safe name for a site, so several consify sites on the same
 * machine never collide over a container name, an nginx upstream name or a generated file.
 */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "site";
}
