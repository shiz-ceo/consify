import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

test("`head` of the config puts its meta tags, links and scripts into every page", async ({
  page,
}) => {
  for (const path of ["/en", "/en/docs/v2/quickstart", "/en/blog"]) {
    await open(page, path);
    await expect(page.locator('head meta[name="theme-color"]')).toHaveAttribute(
      "content",
      "#0f0f0f",
    );
    await expect(
      page.locator('head link[rel="preconnect"][href="https://example.com"]'),
    ).toHaveCount(1);
    expect(
      await page.evaluate(() => (window as unknown as { __latticeHead?: boolean }).__latticeHead),
    ).toBe(true);
  }
});

test("the banner is above the header, leads somewhere and can be closed for good", async ({
  page,
}) => {
  await open(page, "/en");
  const banner = page.locator("[data-consify-banner]");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Lattice 2.0 is out: what changed");
  // it sits above the header
  const bannerBox = await banner.boundingBox();
  const headerBox = await page.locator("header").first().boundingBox();
  expect((bannerBox?.y ?? 0) + (bannerBox?.height ?? 0)).toBeLessThanOrEqual(
    (headerBox?.y ?? 0) + 1,
  );

  await banner.getByRole("button", { name: /close/i }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(page.locator("[data-consify-banner]")).toBeHidden();
  // the choice is kept for the next pages too
  await open(page, "/en/blog");
  await expect(page.locator("[data-consify-banner]")).toBeHidden();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => key.startsWith("nd-banner-")),
    ),
  ).toBe(true);
});

test("the banner link goes to the blog and the text is in the language of the page", async ({
  page,
}) => {
  await open(page, "/ru");
  const banner = page.locator("[data-consify-banner]");
  await expect(banner).toContainText("Вышел Lattice 2.0");
  await banner.getByRole("link").click();
  await expect(page).toHaveURL(/\/ru\/blog\/?$/);
});
