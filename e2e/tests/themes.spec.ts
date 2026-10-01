import { expect, type Page, test } from "@playwright/test";
import { defineConfig } from "../../packages/core/src/config/index.ts";
import { contrast, toHex } from "../../packages/core/src/theme/color.ts";
import { presetNames } from "../../packages/core/src/theme/presets.ts";
import { themeToCss } from "../../packages/core/src/theme/tokens.ts";
import { open } from "./helpers.ts";

/** The CSS the site would put into the page for a `theme`; `neutral` adds nothing, a comment stands in. */
const css = (theme: Record<string, unknown>) =>
  themeToCss(defineConfig({ site: { name: "D" }, theme } as never).theme) ||
  "/* the stylesheet as it is */";

/** `rgb(…)` or `oklch(…)` as painted by the browser, turned into a hex color. */
async function paint(
  page: Page,
  selector: string,
  property: "color" | "backgroundColor",
): Promise<string> {
  const rgb = await page
    .locator(selector)
    .first()
    .evaluate((element, prop) => {
      // a canvas turns any CSS color into 8-bit sRGB
      const context = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
      context.fillStyle = getComputedStyle(element)[prop as "color"];
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
    }, property);
  return toHex({ r: (rgb[0] ?? 0) / 255, g: (rgb[1] ?? 0) / 255, b: (rgb[2] ?? 0) / 255 });
}

/** The text that a reader meets on a docs page, on the background it really sits on. */
async function checkRendering(page: Page): Promise<string[]> {
  const page_ = await paint(page, "body", "backgroundColor");
  const problems: string[] = [];
  for (const [name, selector] of [
    ["heading", "article h1, main h1"],
    ["body text", "article p, main p"],
    ["sidebar link", "aside a"],
    ["muted text", ".text-fd-muted-foreground"],
  ] as const) {
    const color = await paint(page, selector, "color");
    const ratio = contrast(color, page_);
    if (ratio < 4.5) problems.push(`${name}: ${color} on ${page_} is ${ratio.toFixed(2)}`);
  }
  return problems;
}

for (const preset of presetNames) {
  for (const scheme of ["light", "dark"] as const) {
    test(`the ${preset} preset (${scheme}) paints readable text on a docs page`, async ({
      page,
    }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), scheme);
      await open(page, "/en/docs/v2/quickstart");
      await page.addStyleTag({ content: css({ preset }) });
      await expect(page.locator("html")).toHaveClass(
        new RegExp(scheme === "dark" ? "dark" : "light"),
      );
      expect(await checkRendering(page)).toEqual([]);
    });
  }
}

test("the preset changes the colors of the page, the brand changes the accent", async ({
  page,
}) => {
  await open(page, "/en/docs/v2/quickstart");
  const before = await paint(page, "body", "backgroundColor");
  await page.addStyleTag({ content: css({ preset: "paper" }) });
  expect(await paint(page, "body", "backgroundColor")).not.toBe(before);

  await page.addStyleTag({ content: css({ brand: "#0ea5e9" }) });
  const accent = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
  );
  expect(accent).toMatch(/^#/);
});

for (const brand of ["#facc15", "#1e3a8a", "#ef4444", "#22c55e", "#ec4899"]) {
  test(`the brand color ${brand} stays readable in both schemes`, async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.addInitScript((value) => localStorage.setItem("theme", value), scheme);
      await open(page, "/en/docs/v2/quickstart");
      await page.addStyleTag({ content: css({ brand }) });
      expect(await checkRendering(page)).toEqual([]);
      // the accent is used as a text color (links) and as a button
      const primary = await paint(page, "html", "color").then(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
        ),
      );
      const bg = await paint(page, "body", "backgroundColor");
      expect(contrast(primary, bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
}
