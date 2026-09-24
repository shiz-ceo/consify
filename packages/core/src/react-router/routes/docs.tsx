import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Callout } from "fumadocs-ui/components/callout";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/notebook/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { ComponentProps } from "react";
import { use } from "react";
import { redirect } from "react-router";
import { getMDXComponents } from "../../components/mdx.tsx";
import { docsLayoutOptions } from "../../layout-options.tsx";
import { format, getMessages } from "../../messages.ts";
import { defaultDocsPath, deprecationOf } from "../../versions.ts";
import { Redirecting } from "../redirecting.tsx";
import { buildMeta, docsivi, isStatic, requireLang } from "../shared.ts";

const { source, docs, config } = docsivi;

type Params = Record<string, string | undefined>;

interface PageData {
  lang: string;
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

  const page = source.getPage(slugs, lang);
  if (!page) throw new Response("Not found", { status: 404 });
  await docs.getPage(page.path)?.preload();

  const alternates: Record<string, string> = {};
  for (const other of config.i18n.languages) {
    const alt = source.getPage(slugs, other);
    if (alt) alternates[other] = alt.url;
  }

  return {
    lang,
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
    path: data.url,
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

  return (
    <DocsPage
      toc={toc}
      full={entry.full}
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
          components={getMDXComponents(config, { a: RelativeLink }, docsivi.customComponents)}
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

function View({ loaderData }: { loaderData: PageData }) {
  const { pageTree } = useFumadocsLoader(loaderData as never) as { pageTree: never };
  return (
    <DocsLayout {...docsLayoutOptions(docsivi, loaderData.lang)} tree={pageTree}>
      <Content data={loaderData} />
    </DocsLayout>
  );
}

export default function DocsRoute({ loaderData }: { loaderData: LoaderData }) {
  if ("redirectTo" in loaderData) return <Redirecting to={loaderData.redirectTo} />;
  return <View loaderData={loaderData} />;
}
