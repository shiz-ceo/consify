import { consify } from "../../shared/router.ts";

export function apiSitemap(): string[] {
  const { config } = consify;
  return config.openapi ? config.i18n.languages.map((lang) => `/${lang}/api`) : [];
}
