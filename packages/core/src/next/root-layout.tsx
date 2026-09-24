import { i18nProvider } from "fumadocs-ui/i18n";
import { RootProvider } from "fumadocs-ui/provider/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import StaticSearchDialog from "../components/static-search.tsx";
import type { Docsivi } from "../instance.ts";
import { createTranslations } from "../layout-options.tsx";
import { themeToCss } from "../theme/tokens.ts";

export function createRootLayout(docsivi: Docsivi) {
  const translations = createTranslations(docsivi);
  const themeCss = themeToCss(docsivi.config.theme);
  return async function RootLayout({
    params,
    children,
  }: {
    params: Promise<{ lang: string }>;
    children: ReactNode;
  }) {
    const { lang } = await params;
    return (
      <html
        lang={lang}
        className={`${GeistSans.variable} ${GeistMono.variable}`}
        suppressHydrationWarning
      >
        <head>{themeCss ? <style id="docsivi-theme">{themeCss}</style> : null}</head>
        <body className="flex min-h-screen flex-col">
          <RootProvider
            i18n={i18nProvider(translations, lang)}
            {...(docsivi.config.deploy.mode === "static"
              ? { search: { SearchDialog: StaticSearchDialog } }
              : {})}
          >
            {children}
          </RootProvider>
        </body>
      </html>
    );
  };
}
