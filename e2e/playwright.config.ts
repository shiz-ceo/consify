import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a production build of the demo site (`apps/demo`): hydration errors
 * and missing files only show there. `E2E_MODE=static` runs the static build instead (no server).
 *
 *   bun run e2e            builds the demo in both modes and runs everything
 *   bun run e2e -- --grep search
 */
const isStatic = process.env.E2E_MODE === "static";
const port = isStatic ? 3401 : 3400;

export default defineConfig({
  testDir: "./tests",
  // the static build has its own test files, the others need a server
  testMatch: isStatic ? /static\.spec\.ts/ : /^(?!.*static\.spec).*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testIgnore: /(a11y|seo|themes)\.spec\.ts/ },
  ],
  webServer: {
    command: isStatic
      ? `bunx serve ../apps/demo/build/client -l ${port} --no-clipboard`
      : `PORT=${port} bun run --cwd ../apps/demo start`,
    url: `http://localhost:${port}/en`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { PATH: `${process.cwd()}/../packages/cli/bin:${process.env.PATH ?? ""}` },
  },
});
