import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

/**
 * Automated accessibility checks (axe, WCAG 2 A and AA) on the kinds of pages the site has, in
 * both color schemes. Only serious and critical problems fail the test.
 */
const pages: [string, string][] = [
  ["/en", "home"],
  ["/en/docs/v2/quickstart", "a docs page"],
  ["/ru/docs/v2/quickstart", "a docs page (ru)"],
  ["/en/blog", "the blog list"],
  ["/en/blog/lattice-2", "a post"],
  ["/en/status", "a custom section"],
  ["/en/nowhere", "the 404 page"],
];

for (const scheme of ["light", "dark"] as const) {
  for (const [path, name] of pages) {
    test(`${name} (${scheme}) has no serious accessibility problems`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("theme", value), scheme);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        serious.map(
          (v) =>
            `${v.id} (${v.impact}): ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")}`,
        ),
      ).toEqual([]);
    });
  }
}

test("the API reference: the site's own parts have no serious problems (Scalar's are its own)", async ({
  page,
}) => {
  await open(page, "/en/api");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .exclude(".scalar-app :not(.consify-scalar-search, .consify-scalar-search *)")
    .analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
});
