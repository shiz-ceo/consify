import { HomeLayout } from "fumadocs-ui/layouts/home";
import { icons } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { DocsConfig } from "../config/index.ts";
import type { Docsivi } from "../instance.ts";
import { baseOptions } from "../layout-options.tsx";
import { defaultDocsPath } from "../versions.ts";

type Home = NonNullable<DocsConfig["home"]>[string];

/** `/docs` → default version, other `/x` → `/{lang}/x`, absolute URLs and anchors are kept. */
export function resolveHref(config: Readonly<DocsConfig>, lang: string, href: string): string {
  if (href === "/docs") return defaultDocsPath(config, lang) ?? `/${lang}/docs`;
  if (href.startsWith("/") && !href.startsWith("//")) return `/${lang}${href}`;
  return href;
}

export function createHomeLayout(docsivi: Docsivi) {
  return async function Layout({
    params,
    children,
  }: {
    params: Promise<{ lang: string }>;
    children: ReactNode;
  }) {
    const { lang } = await params;
    return <HomeLayout {...baseOptions(docsivi, lang)}>{children}</HomeLayout>;
  };
}

function homeContent(config: Readonly<DocsConfig>, lang: string): Home | undefined {
  return config.home?.[lang] ?? config.home?.[config.i18n.defaultLanguage];
}

export function createHomePage({ config }: Docsivi) {
  return async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    const home = homeContent(config, lang);

    if (!home) {
      return (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-3xl font-bold">{config.site.name}</h1>
          {config.site.description ? <p>{config.site.description}</p> : null}
          <a className="font-semibold underline" href={resolveHref(config, lang, "/docs")}>
            Documentation
          </a>
        </main>
      );
    }

    return (
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 py-16 md:py-24">
        <section className="flex flex-col items-center gap-6 text-center">
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
            {home.hero.title}
          </h1>
          {home.hero.description ? (
            <p className="max-w-2xl text-lg text-fd-muted-foreground text-balance">
              {home.hero.description}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3">
            {home.hero.actions.map((action) => (
              <a
                key={action.href + action.label}
                href={resolveHref(config, lang, action.href)}
                className={
                  action.variant === "primary"
                    ? "rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
                    : "rounded-full border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
                }
              >
                {action.label}
              </a>
            ))}
          </div>
        </section>

        {home.features.length > 0 ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {home.features.map((feature) => {
              const Icon = feature.icon ? icons[feature.icon as keyof typeof icons] : undefined;
              const body = (
                <>
                  {Icon ? <Icon className="mb-3 size-5 text-fd-muted-foreground" /> : null}
                  <h3 className="mb-1 font-semibold">{feature.title}</h3>
                  <p className="text-sm text-fd-muted-foreground">{feature.description}</p>
                </>
              );
              const className =
                "block rounded-xl border border-fd-border bg-fd-card p-5 text-fd-card-foreground";
              return feature.href ? (
                <a
                  key={feature.title}
                  href={resolveHref(config, lang, feature.href)}
                  className={`${className} transition-colors hover:bg-fd-accent`}
                >
                  {body}
                </a>
              ) : (
                <div key={feature.title} className={className}>
                  {body}
                </div>
              );
            })}
          </section>
        ) : null}
      </main>
    );
  };
}

/** `generateMetadata` for the home page: site name and description. */
export function createHomeMetadata({ config }: Docsivi) {
  return async function generateMetadata(): Promise<Metadata> {
    return {
      title: config.site.name,
      ...(config.site.description ? { description: config.site.description } : {}),
      ...(config.site.url ? { metadataBase: new URL(config.site.url) } : {}),
    };
  };
}
