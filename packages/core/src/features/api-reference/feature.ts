import type { Feature } from "../types.ts";

export const apiReference: Feature = {
  id: "api-reference",
  dir: import.meta.url,
  enabled: (config) => config.openapi !== undefined,
  routes: () => [{ path: ":lang/api", file: "routes/api-reference.tsx" }],
  nav: (config, lang) =>
    config.openapi ? { text: config.openapi.title, url: `/${lang}/api` } : undefined,
};
