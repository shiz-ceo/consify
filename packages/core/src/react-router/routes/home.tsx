import { icons } from "lucide-react";
import { Link } from "react-router";
import type { DocsConfig } from "../../config/index.ts";
import { resolveHref as resolve } from "../../links.ts";
import { SiteLayout } from "../../site-layout.tsx";
import { buildMeta, docsivi, requireLang } from "../shared.ts";

type Home = NonNullable<DocsConfig["home"]>[string];

function Anchor({ to, ...props }: { to: string } & React.ComponentProps<"a">) {
  return /^(https?:)?\/\//.test(to) ? <a href={to} {...props} /> : <Link to={to} {...props} />;
}

export function loader({ params }: { params: Record<string, string | undefined> }) {
  return { lang: requireLang(params) };
}

export function meta({ loaderData }: { loaderData?: { lang: string } }) {
  const lang = loaderData?.lang ?? docsivi.i18n.defaultLanguage;
  const { site } = docsivi.config;
  return buildMeta({ lang, title: site.name, description: site.description, path: `/${lang}` });
}

export default function HomePage({ loaderData }: { loaderData: { lang: string } }) {
  const { lang } = loaderData;
  const { config } = docsivi;
  const home: Home | undefined = config.home?.[lang] ?? config.home?.[config.i18n.defaultLanguage];

  return (
    <SiteLayout docsivi={docsivi} lang={lang}>
      {!home ? (
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-3xl font-bold">{config.site.name}</h1>
          {config.site.description ? <p>{config.site.description}</p> : null}
          <Link className="font-semibold underline" to={resolve(docsivi.config, lang, "/docs")}>
            Documentation
          </Link>
        </main>
      ) : (
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
                <Anchor
                  key={action.href + action.label}
                  to={resolve(docsivi.config, lang, action.href)}
                  className={
                    action.variant === "primary"
                      ? "rounded-full bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-opacity hover:opacity-90"
                      : "rounded-full border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
                  }
                >
                  {action.label}
                </Anchor>
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
                  <Anchor
                    key={feature.title}
                    to={resolve(docsivi.config, lang, feature.href)}
                    className={`${className} transition-colors hover:bg-fd-accent`}
                  >
                    {body}
                  </Anchor>
                ) : (
                  <div key={feature.title} className={className}>
                    {body}
                  </div>
                );
              })}
            </section>
          ) : null}
        </main>
      )}
    </SiteLayout>
  );
}
