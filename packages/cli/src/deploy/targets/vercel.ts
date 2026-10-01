import type { DeployTarget } from "../types.ts";

export const vercel: DeployTarget = {
  id: "vercel",
  label: "Vercel",
  description: "Static hosting on Vercel, connected to the repository from its dashboard.",
  modes: ["static"],

  write({ config }) {
    const lang = config.i18n.defaultLanguage;
    return [
      {
        path: "vercel.json",
        content: `{
  "buildCommand": "bun run build",
  "outputDirectory": "build/client",
  "framework": null,
  "redirects": [
    { "source": "/", "destination": "/${lang}/", "permanent": false }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
`,
      },
    ];
  },

  notes() {
    return [
      'docs.config.ts must have deploy.mode: "static" — Vercel is used here as a plain static host, not through its Node runtime.',
      "In the Vercel dashboard: Add New → Project → import this repository. vercel.json carries the rest.",
      "No basePath is needed: Vercel serves the site from the root of its own domain (or a custom domain you attach in its settings).",
    ];
  },
};
