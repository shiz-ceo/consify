import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

test("the list shows the posts, filters them by category and searches them", async ({ page }) => {
  await open(page, "/en/blog");
  const cards = page.locator("main article");
  const all = await cards.count();
  expect(all).toBeGreaterThan(3);

  await page.getByRole("button", { name: "Releases" }).click();
  await expect.poll(async () => cards.count()).toBeLessThan(all);
  await page.getByRole("button", { name: "All posts" }).click();
  await expect.poll(async () => cards.count()).toBe(all);

  await page.getByPlaceholder("Search posts...").fill("scheduler");
  await expect.poll(async () => cards.count()).toBeLessThan(all);
  await expect(page.getByText("How the Lattice scheduler sleeps").first()).toBeVisible();
  await page.getByPlaceholder("Search posts...").fill("no such words anywhere");
  await expect(page.getByText("No posts found.")).toBeVisible();
});

test("a post has the table of contents, authors, a reading time and share buttons", async ({
  page,
}) => {
  await open(page, "/en/blog/lattice-2");
  await expect(page.locator("h1").first()).toContainText("Lattice 2.0");
  await expect(page.getByText(/min read/).first()).toBeAttached();
  await expect(
    page.getByText("In this article").or(page.getByText("On this page")).first(),
  ).toBeAttached();
  await expect(
    page
      .getByRole("link", { name: "X" })
      .or(page.getByRole("button", { name: "X" }))
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to the blog/ })).toBeVisible();
});

test("a post has the tags for the social networks and the feed is announced", async ({ page }) => {
  await open(page, "/en/blog/lattice-2");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /\/en\/blog\/og\/lattice-2\.png/,
  );
  await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveCount(1);
  await open(page, "/en/blog");
  await expect(page.locator('link[type="application/rss+xml"]')).toHaveAttribute(
    "href",
    /rss\.xml$/,
  );
});

test("the image for the social networks is a PNG", async ({ request }) => {
  const response = await request.get("/en/blog/og/lattice-2.png");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
});

test("a post without a translation is shown in the default language with a notice", async ({
  page,
}) => {
  await open(page, "/ru/blog/acme-story");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("Эту страницу ещё не перевели")).toBeVisible();
});
