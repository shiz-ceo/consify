import type { DeployTarget } from "../types.ts";

export const netlify: DeployTarget = {
  id: "netlify",
  label: "Netlify",
  description: "Static hosting on Netlify, connected to the repository from its dashboard.",
  modes: ["static"],

  write({ config }) {
    const lang = config.i18n.defaultLanguage;
    return [
      {
        path: "netlify.toml",
        content: `[build]
  command = "bun run build"
  publish = "build/client"

# \`/\` is a page (a build with no server cannot answer with a redirect on its own), this makes it
# a real one for readers who land on the bare domain.
[[redirects]]
  from = "/"
  to = "/${lang}/"
  status = 302

# hashed filenames never change contents, so browsers and the CDN can cache them forever
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
`,
      },
    ];
  },

  notes() {
    return [
      'docs.config.ts must have deploy.mode: "static".',
      "In the Netlify dashboard: Add new site → Import an existing project → this repository. Netlify reads netlify.toml for the rest.",
      "No basePath is needed: Netlify serves the site from the root of its own domain (or a custom domain you attach in its settings).",
    ];
  },
};
