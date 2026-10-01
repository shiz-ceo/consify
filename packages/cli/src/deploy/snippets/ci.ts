/**
 * The steps every generated `--ci` workflow runs before it deploys anything: install, then the
 * three things that actually catch a broken docs site — `consify doctor` (versions, config),
 * `typecheck` (a broken import or a bad option), and `build` (which renders every page in every
 * language, so a broken link or a bad MDX file fails right here, not in production).
 */
export const ciChecks = `      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bunx consify doctor
      - run: bun run typecheck
      - run: bun run build`;

/** Only re-runs the workflow when something that changes the built site actually changed. */
export const ciPaths = `["content/**", "custom/**", "docs.config.ts", "public/**", "package.json", "bun.lock"]`;

export function ciHeader(name: string): string {
  return `name: ${name}

on:
  push:
    branches: [main]
    paths: ${ciPaths}
  workflow_dispatch:

concurrency:
  group: deploy
  cancel-in-progress: true
`;
}
