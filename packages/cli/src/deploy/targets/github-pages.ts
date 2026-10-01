import type { DeployTarget } from "../types.ts";

function safeHost(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

export const githubPages: DeployTarget = {
  id: "github-pages",
  label: "GitHub Pages",
  description: "Free static hosting from a GitHub repository, deployed by a workflow on push.",
  modes: ["static"],

  write() {
    return [
      {
        path: ".github/workflows/deploy.yml",
        content: `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

# only one deploy at a time; a new push cancels the one in progress
concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: build/client

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`,
      },
    ];
  },

  notes({ config }) {
    const notes = [
      'docs.config.ts must have deploy.mode: "static" — GitHub Pages serves plain files, there is no server.',
      'In the repository settings, under Pages, set Source to "GitHub Actions".',
    ];
    if (config.site.url) {
      const host = safeHost(config.site.url);
      if (host) {
        notes.push(
          `site.url is set to a custom domain (${host}): add a public/CNAME file containing "${host}" and point its DNS at GitHub Pages, and deploy.basePath is not needed.`,
        );
      }
    } else {
      notes.push(
        'site.url is not set. Without a custom domain the site is served from /<repository name>/: set deploy.basePath to that path (e.g. "/my-docs") and site.url to https://<user>.github.io/<repository>.',
      );
    }
    return notes;
  },
};
