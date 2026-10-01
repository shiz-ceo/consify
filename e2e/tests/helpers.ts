import { expect, type Page } from "@playwright/test";

/** Messages that are not the site's fault: fonts of a fake host, Scalar's cloud calls, favicons. */
const ignored = [
  /example\.com/,
  /favicon/i,
  /proxy\.scalar\.com/,
  /scalar\.com/,
  /Failed to load resource: net::ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION_REFUSED)/,
];

/** Collects the errors of a page: exceptions, `console.error`, failed requests of the site itself. */
export function watchErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`exception: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !ignored.some((p) => p.test(message.text()))) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (
      new URL(url).origin === new URL(page.url() || url).origin &&
      !ignored.some((p) => p.test(url))
    ) {
      errors.push(`request failed: ${url}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`${response.status()}: ${response.url()}`);
  });
  return () => errors;
}

/** Opens a page and waits until React has taken it over, so that clicks are not lost. */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("body")).toBeVisible();
}

/**
 * On a phone the header has the name of the site and one button that opens the sidebar; the links,
 * the language and the theme are inside it. Opens it there, does nothing on a desktop.
 */
export async function openDrawer(page: Page): Promise<void> {
  if (!isMobile(page)) return;
  // "Open Sidebar" in English, translated in the other languages
  await page
    .locator("header")
    .getByRole("button", { name: /sidebar|панел/i })
    .first()
    .click();
}

/** True on the phone project: the layout has a menu button instead of the links. */
export const isMobile = (page: Page): boolean => (page.viewportSize()?.width ?? 1280) < 768;
