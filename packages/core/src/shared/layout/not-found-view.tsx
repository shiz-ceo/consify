import { Link } from "react-router";
import { getMessages } from "../messages.ts";
import { consify } from "../router.ts";
import { SitePage } from "./site-layout.tsx";

/** Shown for unknown URLs. Also used by the root error boundary. */
export function NotFound({ lang }: { lang?: string }) {
  const language = lang ?? consify.i18n.defaultLanguage;
  const messages = getMessages(consify.config, language);
  return (
    <SitePage consify={consify} lang={language}>
      <title>{`404 | ${consify.config.site.name}`}</title>
      <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
        <h1 className="mb-2 text-xl font-bold">404</h1>
        <p className="mb-4 text-fd-muted-foreground">{messages.notFound}</p>
        <Link
          className="rounded-full bg-fd-primary px-4 py-2.5 text-sm font-medium text-fd-primary-foreground"
          to={`/${language}`}
        >
          {messages.backToHome}
        </Link>
      </div>
    </SitePage>
  );
}
