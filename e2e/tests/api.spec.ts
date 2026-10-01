import { expect, test } from "@playwright/test";
import { isMobile, open, openDrawer } from "./helpers.ts";

test("Scalar renders, and every group of operations is open in the content", async ({ page }) => {
  test.skip(isMobile(page), "the desktop layout of Scalar");
  await open(page, "/en/api");
  await expect(page.locator(".scalar-app").first()).toBeVisible();
  // operations of different groups are on the page without clicking anything
  await expect(page.getByText("Get current principal").first()).toBeVisible();
  // Scalar draws the content while it is scrolled to, so go down the page: the operations of the
  // other groups are shown in the content, not hidden inside a closed group
  const inContent = (name: string) =>
    page.locator(".scalar-app :not(.t-doc__sidebar *)").getByText(name, { exact: true });
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 1500);
    await page.waitForTimeout(150);
  }
  await expect(inContent("Get queue by ID").first()).toBeVisible();
});

test("the search field at the top of the sidebar opens the search of Scalar", async ({ page }) => {
  test.skip(isMobile(page), "the sidebar is closed on the phone");
  await open(page, "/en/api");
  const field = page.locator(".consify-scalar-search [data-search-full]");
  await expect(field).toBeVisible();
  // same size as the field of the docs sidebar
  const box = await field.boundingBox();
  expect(Math.round(box?.height ?? 0)).toBe(36);
  await field.click();
  await expect(page.locator(".scalar-modal")).toBeVisible();
  await expect(page.locator(".scalar-modal input")).toBeFocused();
});

test("the header has the same links as everywhere and no search", async ({ page }) => {
  await open(page, "/en/api");
  await expect(page.locator("header [data-search], header [data-search-full]")).toHaveCount(0);
});

test("Scalar follows the theme of the site", async ({ page }) => {
  await open(page, "/en/api");
  const background = () =>
    page.evaluate(() =>
      getComputedStyle(document.querySelector(".scalar-app") as Element)
        .getPropertyValue("--scalar-background-1")
        .trim(),
    );
  const before = await background();
  await openDrawer(page);
  await page.getByRole("button", { name: /theme/i }).first().click();
  await expect.poll(background).not.toBe(before);
});
