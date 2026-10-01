import { format, Mdx, type PageProps } from "@consify/core";
import { consify, docsLayoutOptions, FallbackNotice, Footer, useMessages } from "@consify/core/ui";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Callout } from "fumadocs-ui/components/callout";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/notebook/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { type ComponentProps, createContext, useContext } from "react";
import type { DocsMessages, DocsPageData } from "./index.ts";

/** Where links relative to the page start: its folder, as an address. */
const LinkBase = createContext("/");

/**
 * A link of a docs page: `./quickstart.mdx` (a file next to the page) is the address of that page.
 * Other links are left as they are.
 */
function DocsLink({ href, ...props }: ComponentProps<"a">) {
  const base = useContext(LinkBase);
  const Anchor = defaultMdxComponents.a;
  const file = href?.split("#")[0] ?? "";
  if (href && !/^[a-z]+:|^\/|^#/.test(href) && /\.mdx?$/.test(file)) {
    const hash = href.split("#")[1];
    const path = file.replace(/\.mdx?$/, "").replace(/(^|\/)index$/, "");
    const url = new URL(path, `https://site${base}`).pathname.replace(/\/$/, "");
    return <Anchor href={hash ? `${url}#${hash}` : url} {...props} />;
  }
  return <Anchor href={href} {...props} />;
}

/** A docs page: the layout with its sidebar and the page with its table of contents. */
export default function Page({ data, lang }: PageProps<DocsPageData>) {
  const messages = useMessages<DocsMessages>();
  const { pageTree } = useFumadocsLoader({ pageTree: data.tree } as never) as { pageTree: never };
  const { id } = data;
  const { toc: showToc, breadcrumbs, pagination } = data.show;
  // links relative to the file start in its folder: the page itself for an `index.mdx`
  const base = /(^|\/)index\.mdx?$/.test(data.path)
    ? `${data.url}/`
    : data.url.replace(/[^/]*$/, "");

  const editLink = data.editUrl ? (
    <a
      href={data.editUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-fd-muted-foreground underline-offset-4 hover:text-fd-foreground hover:underline"
    >
      {messages.editOnGithub}
    </a>
  ) : null;

  return (
    <>
      <DocsLayout {...docsLayoutOptions(consify, lang, id, true)} tree={pageTree}>
        <DocsPage
          toc={data.toc}
          full={data.data.full ?? false}
          tableOfContent={{ enabled: showToc }}
          breadcrumb={{ enabled: breadcrumbs }}
          footer={{ enabled: pagination, children: editLink }}
        >
          {data.fallback ? <FallbackNotice original={data.original} /> : null}
          {data.deprecated ? (
            <Callout type="warn">
              {format(messages.deprecatedVersion, { version: data.deprecated.version })}{" "}
              {data.deprecated.latest ? (
                <a className="font-medium underline" href={data.deprecated.latest.url}>
                  {format(messages.goToLatest, { latest: data.deprecated.latest.label })}
                </a>
              ) : null}
            </Callout>
          ) : null}
          <DocsTitle>{data.data.title}</DocsTitle>
          <DocsDescription>{data.data.description}</DocsDescription>
          <DocsBody>
            <LinkBase value={base}>
              <Mdx code={data.code} components={{ a: DocsLink }} className="" />
            </LinkBase>
          </DocsBody>
          {pagination ? null : editLink}
        </DocsPage>
      </DocsLayout>
      <Footer consify={consify} lang={lang} />
    </>
  );
}
