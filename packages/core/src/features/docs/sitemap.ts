import { isFallbackPage } from "../../shared/fallback.ts";
import { consify } from "../../shared/router.ts";

/**
 * Every docs page. A page shown without a translation is a copy of the original, so its address
 * is left out (unless `i18n.fallback` is `show`).
 */
export function docsSitemap(): string[] {
  const { config, source } = consify;
  const { defaultLanguage } = config.i18n;
  return source
    .getPages()
    .filter(
      (page) =>
        config.i18n.fallback === "show" ||
        !isFallbackPage(page.path, page.locale ?? defaultLanguage, defaultLanguage),
    )
    .map((page) => page.url);
}
