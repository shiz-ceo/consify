import { home as mdxHome } from "docsivi:home";
import { DocsBody } from "fumadocs-ui/layouts/notebook/page";
import { use } from "react";
import { redirect } from "react-router";
import { Redirecting } from "../../../shared/layout/redirecting.tsx";
import { SiteLayout } from "../../../shared/layout/site-layout.tsx";
import { buildMeta, docsivi, isStatic, requireLang } from "../../../shared/router.ts";
import { getMDXComponents } from "../../../shared/ui/mdx.tsx";
import { SiteLink } from "../../../shared/ui/site-link.tsx";
import { defaultDocsPath } from "../../../shared/versions.ts";
import { HomeProvider } from "../ui/context.tsx";
import { Features, Hero } from "../ui/home-parts.tsx";

type Params = Record<string, string | undefined>;

/**
 * What the home page (`/{lang}`) shows, first match wins:
 * 1. the project's own component (`custom/home.tsx` or `slots.home`),
 * 2. `content/home.mdx`,
 * 3. the `home` block of the config (a heading and cards),
 * 4. nothing: the reader is sent to the documentation.
 */
type LoaderData =
  | { mode: "slot"; lang: string }
  | { mode: "mdx"; lang: string; path: string }
  | { mode: "config"; lang: string }
  | { mode: "redirect"; lang: string; to: string };

export async function loader({ params }: { params: Params }): Promise<LoaderData> {
  const lang = requireLang(params);
  const { config, slots } = docsivi;

  if (slots.Home) return { mode: "slot", lang };

  const entry = mdxHome?.entry(lang);
  if (entry) {
    await entry.preload();
    return { mode: "mdx", lang, path: entry.info.path };
  }

  if (config.home) return { mode: "config", lang };

  const to = defaultDocsPath(config, lang) ?? `/${lang}/docs`;
  // there is no server in static mode: the page redirects itself
  if (!isStatic) throw redirect(to);
  return { mode: "redirect", lang, to };
}

export function meta({ loaderData }: { loaderData?: LoaderData }) {
  if (!loaderData || loaderData.mode === "redirect") return [];
  const { lang } = loaderData;
  const { site } = docsivi.config;
  const page = loaderData.mode === "mdx" ? mdxHome?.collection.get(loaderData.path) : undefined;
  return buildMeta({
    lang,
    title: page?.title ?? site.name,
    description: page?.description ?? site.description,
    path: `/${lang}`,
  });
}

function MdxHomePage({ path }: { path: string }) {
  const entry = mdxHome?.collection.get(path);
  if (!entry) throw new Error(`unknown home file: ${path}`);
  // the content was preloaded in the loader, so this does not suspend
  use(entry.load());
  const Body = entry.body;
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 md:py-24">
      <DocsBody>
        <Body
          components={getMDXComponents(
            docsivi.config,
            { a: SiteLink, Hero, Features },
            docsivi.customComponents,
          )}
        />
      </DocsBody>
    </main>
  );
}

function ConfigHomePage({ lang }: { lang: string }) {
  const { config } = docsivi;
  const home = config.home?.[lang] ?? config.home?.[config.i18n.defaultLanguage];
  if (!home) return null;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-16 md:py-24">
      <Hero
        title={home.hero.title}
        description={home.hero.description}
        actions={home.hero.actions}
      />
      <Features items={home.features} />
    </main>
  );
}

export default function HomeRoute({ loaderData }: { loaderData: LoaderData }) {
  if (loaderData.mode === "redirect") return <Redirecting to={loaderData.to} />;
  const { lang } = loaderData;
  const Slot = docsivi.slots.Home;

  return (
    <SiteLayout docsivi={docsivi} lang={lang} page="home">
      <HomeProvider value={{ docsivi, lang }}>
        {loaderData.mode === "slot" && Slot ? <Slot docsivi={docsivi} lang={lang} /> : null}
        {loaderData.mode === "mdx" ? <MdxHomePage path={loaderData.path} /> : null}
        {loaderData.mode === "config" ? <ConfigHomePage lang={lang} /> : null}
      </HomeProvider>
    </SiteLayout>
  );
}
