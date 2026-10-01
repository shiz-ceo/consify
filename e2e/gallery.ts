// Takes the screenshots of the theme gallery of the documentation: every preset in both color
// schemes, on the same page of the demo site. The theme is applied the way the site applies it
// (the CSS that `themeToCss` makes), so the pictures cannot drift from the code.
//
//   bun run e2e:themes        needs a build of the demo (`bun run build:demo`)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { defineConfig } from "../packages/core/src/config/index.ts";
import { presetNames } from "../packages/core/src/theme/presets.ts";
import { themeToCss } from "../packages/core/src/theme/tokens.ts";

const root = join(import.meta.dir, "..");
const out = join(root, "apps/docs/public/themes");
const port = 3402;
mkdirSync(out, { recursive: true });

const server = Bun.spawn(["bun", "run", "--cwd", join(root, "apps/demo"), "start"], {
  env: {
    ...process.env,
    PORT: String(port),
    PATH: `${join(root, "packages/cli/bin")}:${process.env.PATH ?? ""}`,
  },
  stdout: "ignore",
  stderr: "ignore",
});

async function waitForServer(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/en`)).status < 500) return;
    } catch {}
    await Bun.sleep(500);
  }
  throw new Error("the demo server did not start");
}

try {
  await waitForServer();
  const browser = await chromium.launch();
  const css = (theme: Record<string, unknown>) =>
    themeToCss(defineConfig({ site: { name: "D" }, theme } as never).theme);
  const variants: [string, Record<string, unknown>][] = [
    ...presetNames.map((name): [string, Record<string, unknown>] => [name, { preset: name }]),
    ["brand", { brand: "#e11d8f" }],
  ];
  for (const scheme of ["light", "dark"] as const) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 760 },
      deviceScaleFactor: 1,
    });
    await context.addInitScript((value) => {
      localStorage.setItem("theme", value);
      // the announcement of the demo would cover the top of every picture
      localStorage.setItem("nd-banner-ijwdwzljgrmxy4ztmvsw2zi", "true");
    }, scheme);
    const page = await context.newPage();
    for (const [name, theme] of variants) {
      await page.goto(`http://localhost:${port}/en/docs/v2/quickstart`);
      await page.waitForLoadState("networkidle");
      const styles = css(theme);
      if (styles) await page.addStyleTag({ content: styles });
      await page.evaluate(() => {
        for (const banner of document.querySelectorAll("[data-consify-banner]")) banner.remove();
      });
      await page.waitForTimeout(200);
      await page.screenshot({
        path: join(out, `${name}-${scheme}.jpg`),
        type: "jpeg",
        quality: 80,
      });
      console.log(`${name}-${scheme}.jpg`);
    }
    await context.close();
  }
  await browser.close();
} finally {
  server.kill();
}
