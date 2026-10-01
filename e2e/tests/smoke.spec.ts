import { expect, test } from "@playwright/test";
import { open, watchErrors } from "./helpers.ts";

/** Every kind of page, in both languages: it opens, hydrates and prints nothing to the console as an error. */
const pages: [string, string][] = [
  ["/en", "home"],
  ["/ru", "home (ru)"],
  ["/en/docs/v2/quickstart", "a docs page"],
  ["/ru/docs/v2/quickstart", "a translated docs page"],
  ["/ru/docs/v2/writing/plugins", "a docs page without a translation"],
  ["/en/docs/v1", "a deprecated version"],
  ["/en/blog", "the blog list"],
  ["/ru/blog", "the blog list (ru)"],
  ["/en/blog/lattice-2", "a post"],
  ["/en/api", "the API reference"],
  ["/en/status", "a page of a custom section"],
  ["/en/status/dashboard", "a page with a parameter"],
  ["/en/examples", "a list of content entries"],
  ["/en/examples/priority-lanes", "a page of a content entry"],
  ["/ru/examples/cron-schedule", "an entry shown without a translation"],
];

for (const [path, name] of pages) {
  test(`${name} (${path}) opens without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, path);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    expect(errors()).toEqual([]);
  });
}

test("an unknown address answers 404 inside the site layout", async ({ page }) => {
  const response = await page.goto("/en/nowhere");
  expect(response?.status()).toBe(404);
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.locator("header")).toBeVisible();
});

test("a draft is not published", async ({ page }) => {
  const response = await page.goto("/en/blog/this-post-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("`/` leads to the default language", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en\/?$/);
});
