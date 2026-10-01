import type { DeployTarget } from "../types.ts";

export const cloudflarePages: DeployTarget = {
  id: "cloudflare-pages",
  label: "Cloudflare Pages",
  description:
    "Static hosting on Cloudflare's CDN, connected to the repository from its dashboard.",
  modes: ["static"],

  write({ config }) {
    const lang = config.i18n.defaultLanguage;
    return [
      {
        path: "public/_redirects",
        content: `# \`/\` is a page (a build with no server cannot answer with a redirect on its own), this makes it
# a real one for readers who land on the bare domain.
/  /${lang}/  302
`,
      },
      {
        path: "public/_headers",
        content: `# hashed filenames never change contents, so browsers and the CDN can cache them forever
/assets/*
  Cache-Control: public, max-age=31536000, immutable
`,
      },
    ];
  },

  notes() {
    return [
      'docs.config.ts must have deploy.mode: "static".',
      "In the Cloudflare dashboard: Workers & Pages → Create → Pages → connect this repository. Build command: bun run build. Build output directory: build/client.",
      "No basePath is needed: Cloudflare Pages serves the site from the root of its own domain (or a custom domain you attach in its settings).",
    ];
  },
};
