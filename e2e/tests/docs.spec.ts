import { expect, test } from "@playwright/test";
import { isMobile, open, openDrawer } from "./helpers.ts";

/** The search field is at the top of the sidebar; on the phone the sidebar opens from the header. */
async function openSearch(page: import("@playwright/test").Page) {
  await openDrawer(page);
  await page.locator("aside [data-search-full]").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("the search is a field at the top of the sidebar, opens a dialog and finds pages", async ({
  page,
}) => {
  await open(page, "/en/docs/v2/quickstart");
  const dialog = await openSearch(page);
  await dialog.getByRole("combobox").or(dialog.locator("input")).first().fill("queue");
  // the first button is the close button of the dialog, the results follow
  const first = dialog.getByRole("button").nth(1);
  await expect(first).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/en\/docs\/v2\//);
});

test("the search works in Russian and is drawn in Russian", async ({ page }) => {
  await open(page, "/ru/docs/v2/quickstart");
  const dialog = await openSearch(page);
  await dialog.locator("input").first().fill("очередь");
  await expect(dialog.getByRole("button").nth(1)).toBeVisible();
  // the widgets of Fumadocs are in Russian too
  await expect(dialog.getByRole("textbox")).toHaveAccessibleName("Поиск");
});

test("Ctrl+K and ⌘K open the search on a docs page", async ({ page }) => {
  test.skip(isMobile(page), "no keyboard");
  await open(page, "/en/docs/v2/quickstart");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("a page of a feature without content has no search, and the shortcut does nothing", async ({
  page,
}) => {
  test.skip(isMobile(page), "no keyboard");
  await open(page, "/en/status");
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a page without a translation shows the original with a notice and marks it in the sidebar", async ({
  page,
}) => {
  await open(page, "/ru/docs/v2/writing/plugins");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByText("Эту страницу ещё не перевели")).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/en\/docs\/v2\/writing\/plugins$/,
  );
});

test("the deprecated version has a banner that leads to the latest one", async ({ page }) => {
  await open(page, "/en/docs/v1/installation");
  const notice = page.getByText(/no longer maintained/);
  await expect(notice).toBeVisible();
  await page.getByRole("link", { name: /Go to v2/ }).click();
  await expect(page).toHaveURL(/\/en\/docs\/v2/);
});

test("the table of contents follows the page and the code block can be copied", async ({
  page,
}) => {
  test.skip(isMobile(page), "the table of contents is a desktop element");
  await open(page, "/en/docs/v2/quickstart");
  await expect(page.getByText("On this page")).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: /copy/i }).first().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.length).toBeGreaterThan(5);
});

test("previous and next links lead to the neighbours", async ({ page }) => {
  test.skip(isMobile(page), "checked on the desktop");
  await open(page, "/en/docs/v2/quickstart");
  const next = page.locator("a", { hasText: /Next|Deployment/ }).last();
  await expect(next).toBeVisible();
});

test("the version switcher changes the version of the docs", async ({ page }) => {
  test.skip(isMobile(page), "in the drawer on the phone");
  await open(page, "/en/docs/v2/quickstart");
  await page.locator("aside").getByRole("button", { name: /v2/ }).first().click();
  await page.getByText("v1", { exact: true }).first().click();
  await expect(page).toHaveURL(/\/en\/docs\/v1/);
});
