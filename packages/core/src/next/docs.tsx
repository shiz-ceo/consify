import { Callout } from "fumadocs-ui/components/callout";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getMDXComponents } from "../components/mdx.tsx";
import type { Docsivi } from "../instance.ts";
import { baseOptions } from "../layout-options.tsx";
import { format, getMessages } from "../messages.ts";
import { defaultDocsPath, deprecationOf } from "../versions.ts";
import { ogImagePath } from "./og.tsx";
import { redirectTo } from "./redirect.tsx";

type LangParams = { params: Promise<{ lang: string }> };
type PageParams = { params: Promise<{ lang: string; slug?: string[] }> };

export function createDocsLayout(docsivi: Docsivi) {
  return async function Layout({ params, children }: LangParams & { children: ReactNode }) {
    const { lang } = await params;
    return (
      <DocsLayout {...baseOptions(docsivi, lang)} tree={docsivi.source.getPageTree(lang)}>
        {children}
      </DocsLayout>
    );
  };
}

export function createDocsPage(docsivi: Docsivi) {
  const { source, config } = docsivi;

  async function Page(props: PageParams) {
    const { slug, lang } = await props.params;
    if (!slug?.length) {
      const target = defaultDocsPath(config, lang);
      if (target) return redirectTo(config, target);
    }
    const page = source.getPage(slug, lang);
    if (!page) notFound();

    const messages = getMessages(config, lang);
    const deprecated = deprecationOf(config, slug);
    const github = config.site.github;
    const editUrl =
      config.features.editOnGithub && github
        ? `https://github.com/${github.repo}/blob/${github.branch}/${github.contentDir}/${page.path}`
        : undefined;
    const MDX = page.data.body;
    return (
      <DocsPage
        toc={page.data.toc}
        full={page.data.full}
        tableOfContent={{ enabled: config.features.toc }}
        breadcrumb={{ enabled: config.features.breadcrumbs }}
        footer={{ enabled: config.features.pagination }}
      >
        {deprecated ? (
          <Callout type="warn">
            {format(messages.deprecatedVersion, {
              version: deprecated.version.label ?? deprecated.version.id,
            })}{" "}
            {deprecated.latest ? (
              <a className="font-medium underline" href={`/${lang}/docs/${deprecated.latest.id}`}>
                {format(messages.goToLatest, {
                  latest: deprecated.latest.label ?? deprecated.latest.id,
                })}
              </a>
            ) : null}
          </Callout>
        ) : null}
        <DocsTitle>{page.data.title}</DocsTitle>
        <DocsDescription>{page.data.description}</DocsDescription>
        <DocsBody>
          <MDX
            components={getMDXComponents(
              config,
              { a: createRelativeLink(source, page) },
              docsivi.customComponents,
            )}
          />
          {editUrl ? (
            <a
              className="mt-8 inline-block text-sm text-fd-muted-foreground underline"
              href={editUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {messages.editOnGithub}
            </a>
          ) : null}
        </DocsBody>
      </DocsPage>
    );
  }

  function generateStaticParams() {
    const params = source.generateParams();
    // `/docs` itself has no page when the site is versioned, but it must still resolve (redirect).
    if (config.versions.default === undefined) return params;
    return [...params, ...config.i18n.languages.map((lang) => ({ lang, slug: [] }))];
  }

  async function generateMetadata(props: PageParams): Promise<Metadata> {
    const { slug, lang } = await props.params;
    const page = source.getPage(slug, lang);
    if (!page) notFound();
    const origin = config.site.url;
    const pathFor = (l: string) => source.getPage(slug, l)?.url;
    return {
      title: page.data.title,
      description: page.data.description,
      ...(origin ? { metadataBase: new URL(origin) } : {}),
      alternates: {
        canonical: page.url,
        // hreflang links, only for languages that have their own version of the page
        languages: Object.fromEntries(
          config.i18n.languages.flatMap((l) => {
            const path = pathFor(l);
            return path ? [[l, path]] : [];
          }),
        ),
      },
      ...(config.features.og ? { openGraph: { images: ogImagePath(lang, page.slugs) } } : {}),
    };
  }

  return { Page, generateStaticParams, generateMetadata };
}
