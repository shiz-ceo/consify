import { redirect } from "react-router";
import { Redirecting } from "../redirecting.tsx";
import { docsivi, isStatic } from "../shared.ts";

const target = `/${docsivi.i18n.defaultLanguage}`;

/** `/` goes to the default language: an HTTP redirect on a server, a meta refresh in static mode. */
export function loader() {
  if (!isStatic) throw redirect(target);
  return null;
}

export default function RootRedirect() {
  return <Redirecting to={target} />;
}
