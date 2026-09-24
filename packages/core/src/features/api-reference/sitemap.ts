import { docsivi } from "../../shared/router.ts";

export function apiSitemap(): string[] {
  const { config } = docsivi;
  return config.openapi ? config.i18n.languages.map((lang) => `/${lang}/api`) : [];
}
