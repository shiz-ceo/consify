import { useParams } from "react-router";
import { getMessages, type Messages } from "./messages.ts";
import { consify } from "./router.ts";

/**
 * The strings of the interface in the language of the current page, for a component. The
 * feature's own keys are named by `T`.
 *
 * @example
 * const t = useMessages<BlogMessages>();
 * return <button>{t.share}</button>;
 */
export function useMessages<
  T extends Record<string, string> = Record<never, string>,
>(): Messages<T> {
  const { lang } = useParams();
  const known = lang !== undefined && consify.config.i18n.languages.includes(lang);
  return getMessages<T>(consify.config, known ? lang : consify.i18n.defaultLanguage);
}
