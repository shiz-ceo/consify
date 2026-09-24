import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import type { ComponentProps } from "react";
import { redirect } from "react-router";
import { OpenAPIPage } from "../../components/api-page.tsx";
import { baseOptions } from "../../layout-options.tsx";
import { Redirecting } from "../redirecting.tsx";
import { buildMeta, docsivi, isStatic, requireLang } from "../shared.ts";

type Params = Record<string, string | undefined>;

interface OperationData {
  lang: string;
  title: string;
  description?: string | undefined;
  url: string;
  props: object;
  pageTree: object;
}

type LoaderData = OperationData | { redirectTo: string };

/** The API reference lives on its own, outside the docs tree and its versions. */
export async function loader({ params }: { params: Params }): Promise<LoaderData> {
  const lang = requireLang(params);
  if (!docsivi.config.openapi) throw new Response("Not found", { status: 404 });

  // Server only: this import is removed from the browser bundle together with the loader.
  const { getApiSource } = await import("../openapi-source.ts");
  const source = await getApiSource(docsivi.config);
  const slugs = (params["*"] ?? "").split("/").filter(Boolean);

  // `/{lang}/api` opens the first operation
  if (slugs.length === 0) {
    const first = source.getPages(lang)[0];
    if (!first) throw new Response("Not found", { status: 404 });
    if (!isStatic) throw redirect(first.url);
    return { redirectTo: first.url };
  }

  const page = source.getPage(slugs, lang);
  if (!page) throw new Response("Not found", { status: 404 });
  return {
    lang,
    title: page.data.title ?? page.slugs.join("/"),
    description: page.data.description,
    url: page.url,
    props: (page.data as unknown as { getOpenAPIPageProps(): object }).getOpenAPIPageProps(),
    pageTree: await source.serializePageTree(source.getPageTree(lang)),
  };
}

export function meta({ loaderData }: { loaderData?: LoaderData }) {
  if (!loaderData || "redirectTo" in loaderData) return [];
  return buildMeta({
    lang: loaderData.lang,
    title: `${loaderData.title} | ${docsivi.config.openapi?.title ?? "API"}`,
    description: loaderData.description,
    path: loaderData.url,
  });
}

function View({ data }: { data: OperationData }) {
  const { pageTree } = useFumadocsLoader(data as never) as { pageTree: never };
  return (
    <DocsLayout {...baseOptions(docsivi, data.lang)} tree={pageTree}>
      <DocsPage full>
        <DocsTitle>{data.title}</DocsTitle>
        <DocsDescription>{data.description}</DocsDescription>
        <DocsBody>
          <OpenAPIPage {...(data.props as ComponentProps<typeof OpenAPIPage>)} />
        </DocsBody>
      </DocsPage>
    </DocsLayout>
  );
}

export default function ApiReferenceRoute({ loaderData }: { loaderData: LoaderData }) {
  if ("redirectTo" in loaderData) return <Redirecting to={loaderData.redirectTo} />;
  return <View data={loaderData} />;
}
