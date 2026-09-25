import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Callout } from "fumadocs-ui/components/callout";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/notebook/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ComponentProps } from "react";
import { use } from "react";
import { redirect } from "react-router";
import { isFallbackPage, languageLabel } from "../../../shared/fallback.ts";
import { Footer } from "../../../shared/layout/footer.tsx";
import { docsLayoutOptions } from "../../../shared/layout/layout-options.tsx";
import { Redirecting } from "../../../shared/layout/redirecting.tsx";
import { format, getMessages } from "../../../shared/messages.ts";
import { buildMeta, consify, isStatic, requireLang } from "../../../shared/router.ts";
import { getMDXComponents } from "../../../shared/ui/mdx.tsx";
import { defaultDocsPath, deprecationOf } from "../../../shared/versions.ts";

const { source, docs, config } = consify;

type Params = Record<string, string | undefined>;

interface PageData {
  lang: string;
  /** The page is the one of the default language, shown because there is no translation. */
  fallback: boolean;
  /** The language of the text: the default language for a fallback page, else `lang`. */
  contentLanguage: string;
  /** Address of the page in the default language (the canonical one for a fallback page). */
  originalUrl?: string | undefined;
  slugs: string[];
  /** Path of the file relative to `content/docs`. */
  path: string;
  title: string;
  description?: string | undefined;
  url: string;
  alternates: Record<string, string>;
  pageTree: object;
}

type LoaderData = PageData | { redirectTo: string };

export async function loader({ params }: { params: Params }): Promise<LoaderData> {
  const lang = requireLang(params);
  const slugs = (params["*"] ?? "").split("/").filter(Boolean);

  // `/docs` has no page when the site is versioned: send readers to the default version.
  if (slugs.length === 0) {
    const target = defaultDocsPath(config, lang);
    if (target) {
      if (!isStatic) throw redirect(target);
      return { redirectTo: target };
    }
  }

  const { defaultLanguage } = config.i18n;
  const mode = config.i18n.fallback;
  const page = source.getPage(slugs, lang);
  if (!page && mode === "hide" && lang !== defaultLanguage) {
    // no translation, and untranslated pages are not shown: lead the reader to the original
    const original = source.getPage(slugs, defaultLanguage);
    if (original) {
      if (!isStatic) throw redirect(original.url);
      return { redirectTo: original.url };
    }
  }
  if (!page) throw new Response("Not found", { status: 404 });
  await docs.getPage(page.path)?.preload();

  const fallback = mode !== "show" && isFallbackPage(page.path, lang, defaultLanguage);

  // links to the other languages: only translations that really exist
  const alternates: Record<string, string> = {};
  for (const other of config.i18n.languages) {
    const alt = source.getPage(slugs, other);
    if (alt && (mode === "show" || !isFallbackPage(alt.path, other, defaultLanguage))) {
      alternates[other] = alt.url;
    }
  }

  return {
    lang,
    fallback,
    contentLanguage: fallback ? defaultLanguage : lang,
    originalUrl: source.getPage(slugs, defaultLanguage)?.url,
    slugs,
    path: page.path,
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    alternates,
    pageTree: await source.serializePageTree(source.getPageTree(lang)),
  };
}

export function meta({ loaderData: data }: { loaderData?: LoaderData }) {
  if (!data || "redirectTo" in data) return [];
  return buildMeta({
    lang: data.lang,
    title: data.title,
    description: data.description,
    // a page shown without a translation is a copy: the original is its canonical address
    path: data.fallback && data.originalUrl ? data.originalUrl : data.url,
    alternates: data.alternates,
    ...(config.features.og
      ? { image: `/${data.lang}/og/${[...data.slugs, "image.png"].join("/")}` }
      : {}),
  });
}

function Content({ data }: { data: PageData }) {
  const entry = docs.getPage(data.path);
  const page = source.getPage(data.slugs, data.lang);
  if (!entry || !page) throw new Error(`unknown page: ${data.path}`);

  // Content is loaded lazily and was preloaded in the loader, so this does not suspend.
  const { toc } = use(entry.load());
  const Body = entry.body;

  const messages = getMessages(config, data.lang);
  const deprecated = deprecationOf(config, data.slugs);
  const github = config.site.github;
  const editUrl =
    config.features.editOnGithub && github
      ? `https://github.com/${github.repo}/blob/${github.branch}/${github.contentDir}/${page.path}`
      : undefined;

  // Resolves relative links to other pages, such as `./quickstart.mdx`.
  const Anchor = defaultMdxComponents.a;
  function RelativeLink({ href, ...props }: ComponentProps<"a">) {
    return <Anchor href={href ? source.resolveHref(href, page as never) : href} {...props} />;
  }

  const compactFooter = (
    <Footer consify={consify} lang={data.lang} variant="compact" editUrl={editUrl} />
  );

  return (
    <DocsPage
      toc={toc}
      full={entry.full}
      tableOfContent={{ enabled: config.features.toc }}
      breadcrumb={{ enabled: config.features.breadcrumbs }}
      footer={{ enabled: config.features.pagination, children: compactFooter }}
    >
      {data.fallback ? (
        <Callout type="info">
          {format(messages.notTranslated, {
            language: languageLabel(config, config.i18n.defaultLanguage),
          })}
          {data.originalUrl ? (
            <>
              {" "}
              <a className="font-medium underline" href={data.originalUrl}>
                {format(messages.openOriginal, {
                  language: languageLabel(config, config.i18n.defaultLanguage),
                })}
              </a>
            </>
          ) : null}
        </Callout>
      ) : null}
      {deprecated ? (
        <Callout type="warn">
          {format(messages.deprecatedVersion, {
            version: deprecated.version.label ?? deprecated.version.id,
          })}{" "}
          {deprecated.latest ? (
            <a
              className="font-medium underline"
              href={`/${data.lang}/docs/${deprecated.latest.id}`}
            >
              {format(messages.goToLatest, {
                latest: deprecated.latest.label ?? deprecated.latest.id,
              })}
            </a>
          ) : null}
        </Callout>
      ) : null}
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description}</DocsDescription>
      <DocsBody>
        <Body
          components={getMDXComponents(config, { a: RelativeLink }, consify.customComponents)}
        />
      </DocsBody>
      {config.features.pagination ? null : compactFooter}
    </DocsPage>
  );
}

function View({ loaderData }: { loaderData: PageData }) {
  const { pageTree } = useFumadocsLoader(loaderData as never) as { pageTree: never };
  return (
    <DocsLayout {...docsLayoutOptions(consify, loaderData.lang, "docs")} tree={pageTree}>
      <Content data={loaderData} />
    </DocsLayout>
  );
}

export default function DocsRoute({ loaderData }: { loaderData: LoaderData }) {
  if ("redirectTo" in loaderData) return <Redirecting to={loaderData.redirectTo} />;
  return <View loaderData={loaderData} />;
}
