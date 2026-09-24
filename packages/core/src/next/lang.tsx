import type { Docsivi } from "../instance.ts";
import { redirectTo } from "./redirect.tsx";

/** `generateStaticParams` for `app/[lang]/layout.tsx`: one entry per configured language. */
export function createLangParams({ i18n }: Docsivi) {
  return () => i18n.languages.map((lang) => ({ lang }));
}

/**
 * Default export of `app/page.tsx`: sends `/` to the default language. In server mode the proxy
 * already does this per visitor language, in static mode (no proxy) this is the only redirect.
 */
export function createRootRedirect({ config, i18n }: Docsivi) {
  return function RootRedirect() {
    return redirectTo(config, `/${i18n.defaultLanguage}`);
  };
}
