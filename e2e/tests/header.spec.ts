import { expect, test } from "@playwright/test";
import { isMobile, open, openDrawer, watchErrors } from "./helpers.ts";

test("the header has no search, whatever the page", async ({ page }) => {
  for (const path of ["/en", "/en/blog", "/en/docs/v2/quickstart", "/en/api", "/en/status"]) {
    await open(page, path);
    await expect(page.locator("header [data-search], header [data-search-full]")).toHaveCount(0);
  }
});

test("the drop-down menu lists places with their descriptions and leads to them", async ({
  page,
}) => {
  test.skip(isMobile(page), "the phone has the mobile menu, see below");
  await open(page, "/en/blog");
  await page.getByRole("button", { name: "Developers" }).first().click();
  const menu = page
    .getByRole("dialog")
    .or(page.locator("[data-radix-popper-content-wrapper]"))
    .first();
  await expect(menu.getByText("Every endpoint, with a client to try it")).toBeVisible();
  await expect(menu.getByText("Live state of the services")).toBeVisible();
  await menu.getByRole("link", { name: /Status/ }).click();
  await expect(page).toHaveURL(/\/en\/status$/);
});

test("the links of the header lead to their sections", async ({ page }) => {
  test.skip(isMobile(page), "the phone has the mobile menu, see below");
  await open(page, "/en");
  await page.locator("header").getByRole("link", { name: "Documentation" }).first().click();
  await expect(page).toHaveURL(/\/en\/docs\/v2/);
  await page.locator("header").getByRole("link", { name: "Blog" }).first().click();
  await expect(page).toHaveURL(/\/en\/blog$/);
});

test("the mobile menu lists the links, and the places of a drop-down menu", async ({ page }) => {
  test.skip(!isMobile(page), "only the phone has it");
  await open(page, "/en");
  await openDrawer(page);
  const drawer = page.locator("aside:visible").first();
  await expect(drawer.getByText("Documentation").first()).toBeVisible();
  await expect(drawer.getByText("Developers").first()).toBeVisible();
});

test("the language switcher keeps the page and changes the language", async ({ page }) => {
  await open(page, "/en/docs/v2/quickstart");
  await openDrawer(page);
  await page
    .getByRole("button", { name: /language/i })
    .first()
    .click();
  await page.getByText("Русский").first().click();
  await expect(page).toHaveURL(/\/ru\/docs\/v2\/quickstart\/?$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.locator("h1").first()).toHaveText("Быстрый старт");
});

test("the theme switch changes the theme and it is remembered", async ({ page }) => {
  await open(page, "/en");
  await openDrawer(page);
  const html = page.locator("html");
  const before = await html.getAttribute("class");
  await page.getByRole("button", { name: /theme/i }).first().click();
  await expect.poll(async () => html.getAttribute("class")).not.toBe(before);
  const after = await html.getAttribute("class");
  await page.reload();
  await expect(html).toHaveAttribute("class", after ?? "");
});

test("the page does not flash in the wrong theme before it loads", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  const errors = watchErrors(page);
  await page.goto("/en");
  // the class is there right after the document is parsed, before React
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  expect(errors()).toEqual([]);
});
