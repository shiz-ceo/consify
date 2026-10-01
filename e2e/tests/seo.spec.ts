import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

test("the sitemap lists real pages with absolute addresses, and not the untranslated copies", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("xml");
  const xml = await response.text();
  expect(xml).toContain("<urlset");
  expect(xml).toContain("https://lattice.example.dev/en/docs/v2/quickstart");
  expect(xml).toContain("https://lattice.example.dev/ru/docs/v2/quickstart");
  expect(xml).toContain("https://lattice.example.dev/en/blog/lattice-2");
  expect(xml).toContain("https://lattice.example.dev/en/status");
  // a page shown in Russian without a translation is a copy of the English one
  expect(xml).not.toContain("/ru/docs/v2/writing/plugins");
});

test("robots.txt points to the sitemap", async ({ request }) => {
  const text = await (await request.get("/robots.txt")).text();
  expect(text).toMatch(/sitemap/i);
});

test("llms.txt and the feed are what they say", async ({ request }) => {
  const llms = await request.get("/en/docs/llms.txt");
  expect(llms.status()).toBe(200);
  expect(await llms.text()).toContain("/en/docs/v2/quickstart");
  const feed = await request.get("/en/blog/rss.xml");
  expect(feed.headers()["content-type"]).toContain("xml");
  const xml = await feed.text();
  expect(xml).toContain("<rss");
  expect(xml).toContain("<item>");
});

test("a docs page tells search engines its address and its translations", async ({ page }) => {
  await open(page, "/en/docs/v2/quickstart");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://lattice.example.dev/en/docs/v2/quickstart",
  );
  await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveAttribute(
    "href",
    "https://lattice.example.dev/ru/docs/v2/quickstart",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/en\/docs\/og\/v2\/quickstart\.png/,
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("head title")).not.toBeEmpty();
});

test("the image of a docs page is a PNG", async ({ request }) => {
  const response = await request.get("/en/docs/og/v2/quickstart.png");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});
