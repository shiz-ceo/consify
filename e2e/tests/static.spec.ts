import { expect, test } from "@playwright/test";
import { open, watchErrors } from "./helpers.ts";

/** The static build: plain files served by any static host, no server behind them. */
const pages = [
  "/en/",
  "/ru/",
  "/en/docs/v2/quickstart/",
  "/ru/docs/v2/writing/plugins/",
  "/en/blog/",
  "/en/blog/lattice-2/",
  "/en/api/",
  "/en/status/",
];

for (const path of pages) {
  test(`${path} opens without errors`, async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, path);
    await expect(page.locator("h1, h2").first()).toBeVisible();
    expect(errors()).toEqual([]);
  });
}

test("the search runs in the browser on an index that is a file", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await open(page, "/en/docs/v2/quickstart/");
  await page.locator("aside [data-search-full]").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("input").fill("queue");
  await expect(dialog.getByRole("button").nth(1)).toBeVisible();
  expect(requests.some((url) => url.includes("/docs/search.json"))).toBe(true);
});

test("`/` is a page that leads to the default language, there is no server to redirect", async ({
  page,
  request,
}) => {
  const html = await (await request.get("/")).text();
  expect(html).toContain('http-equiv="refresh"');
  await page.goto("/");
  await expect(page).toHaveURL(/\/en\/?$/, { timeout: 15_000 });
});

test("a page that does not exist gets the 404 page of the site", async ({ page }) => {
  await page.goto("/en/nowhere/");
  await expect(page.getByText("404")).toBeVisible();
});

test("the feed, the sitemap and the images are files", async ({ request }) => {
  for (const path of [
    "/en/blog/rss.xml",
    "/sitemap.xml",
    "/en/docs/llms.txt",
    "/en/blog/og/lattice-2.png",
  ]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});
