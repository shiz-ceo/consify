import type { Feature } from "../types.ts";

export const seo: Feature = {
  id: "seo",
  dir: import.meta.url,
  routes: () => [
    { path: "sitemap.xml", file: "routes/sitemap.ts" },
    { path: "robots.txt", file: "routes/robots.ts" },
  ],
};
