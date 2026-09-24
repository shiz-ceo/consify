import { i18nProvider } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/react-router";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useParams,
  useRouteError,
} from "react-router";
import StaticSearchDialog from "../components/static-search.tsx";
import { createTranslations } from "../layout-options.tsx";
import { themeToCss } from "../theme/tokens.ts";
import { NotFound } from "./not-found-view.tsx";
import { docsivi } from "./shared.ts";

const translations = createTranslations(docsivi);
const themeCss = themeToCss(docsivi.config.theme);

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang } = useParams();
  const language =
    lang && docsivi.config.i18n.languages.includes(lang) ? lang : docsivi.i18n.defaultLanguage;

  return (
    <html lang={language} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {themeCss ? <style id="docsivi-theme">{themeCss}</style> : null}
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          i18n={i18nProvider(translations, language)}
          {...(docsivi.config.deploy.mode === "static"
            ? { search: { SearchDialog: StaticSearchDialog } }
            : {})}
        >
          {children}
        </RootProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const { lang } = useParams();
  if (isRouteErrorResponse(error) && error.status === 404)
    return <NotFound {...(lang ? { lang } : {})} />;

  const details = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : "An unexpected error occurred.";
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="mb-2 text-xl font-bold">Something went wrong</h1>
      <p className="text-fd-muted-foreground">{details}</p>
    </main>
  );
}
