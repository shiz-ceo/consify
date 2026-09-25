import type { Feature } from "../../shared/feature.ts";
import { getMessages } from "../../shared/messages.ts";
import { defaultDocsPath } from "../../shared/versions.ts";

export const docs: Feature = {
  id: "docs",
  dir: import.meta.url,
  routes: () => [
    { path: ":lang/docs/*", file: "routes/docs.tsx" },
    { path: ":lang/llms.txt", file: "routes/llms.ts" },
    { path: ":lang/llms-full.txt", file: "routes/llms-full.ts" },
    { path: ":lang/og/*", file: "routes/og.ts", when: (config) => config.features.og },
  ],
  nav: (config, lang) => ({
    text: getMessages(config, lang).documentation,
    url: defaultDocsPath(config, lang) ?? `/${lang}/docs`,
  }),
};
