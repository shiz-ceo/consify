import { i18nProvider } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/react-router";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useParams,
  useRouteError,
} from "react-router";
import { ServerSearchDialog, StaticSearchBridge } from "../../system/search/search-bridge.tsx";
import { createTranslations } from "../../shared/layout/layout-options.tsx";
import { themeToCss } from "../../theme/tokens.ts";
import { NotFound } from "../../shared/layout/not-found-view.tsx";
import { consify } from "../../shared/router.ts";

const translations = createTranslations(consify);

/**
 * Sets the theme class on <html> before the first paint, from the same storage key that
 * next-themes (inside RootProvider) uses. Its own script sits in <body>, a moment too late: the
 * page canvas could be painted in the wrong color first.
 */
const earlyTheme = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((t===null||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.remove("light","dark");r.classList.add(d?"dark":"light");r.style.colorScheme=d?"dark":"light"}catch(e){}})()`;

/** The configured favicon, or a rounded square with the first letter of the site name. */
function iconHref(): string {
  const { site, deploy } = consify.config;
  if (site.favicon) {
    return site.favicon.startsWith("/") ? `${deploy.basePath ?? ""}${site.favicon}` : site.favicon;
  }
  const letter = [...site.name][0]?.toUpperCase() ?? "D";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#111"/><text x="16" y="23" font-family="system-ui,sans-serif" font-size="20" font-weight="700" text-anchor="middle" fill="#fff">${letter.replace(/[<&>]/g, "")}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
const faviconHref = iconHref();
const themeCss = themeToCss(consify.config.theme);

export function Layout({ children }: { children: React.ReactNode }) {
  const { lang } = useParams();
  const matches = useMatches();
  const language =
    lang && consify.config.i18n.languages.includes(lang) ? lang : consify.i18n.defaultLanguage;
  // sections without a search (`header.hideSearchOn`) have no search dialog and no shortcut either
  const page = matches
    .map((match) => (match.handle as { page?: string } | undefined)?.page)
    .findLast((value) => value !== undefined);
  const searchHidden =
    page !== undefined && (consify.config.header?.hideSearchOn as string[] | undefined)?.includes(page);
  // a page shown without a translation is written in another language than the address says
  const contentLanguage = matches
    .map((match) => (match.loaderData as { contentLanguage?: string } | undefined)?.contentLanguage)
    .findLast((value) => value !== undefined);

  return (
    <html lang={contentLanguage ?? language} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: earlyTheme }} />
        <link rel="icon" href={faviconHref} />
        <Meta />
        <Links />
        {themeCss ? <style id="consify-theme">{themeCss}</style> : null}
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          i18n={i18nProvider(translations, language)}
          search={{
            enabled: !searchHidden,
            SearchDialog:
              consify.config.deploy.mode === "static" ? StaticSearchBridge : ServerSearchDialog,
          }}
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
  if (isRouteErrorResponse(error) && error.status === 404) {
    // `/docs` matches the `:lang` route, so the segment is only a language when it is configured
    const known = lang && consify.config.i18n.languages.includes(lang);
    return <NotFound {...(known ? { lang } : {})} />;
  }

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
