// The browser (and server) half of a page of a feature: its component, `<head>` and handle.
// Generated route modules call these with the id of the feature and the key of the page.
import { useMemo } from "react";
import type { MetaArgs } from "react-router";
import { preloadMdx } from "../content/mdx.ts";
import { featureUrl } from "../feature/paths.ts";
import { featureText } from "../feature/text.ts";
import { createTranslate } from "../feature/translate.ts";
import type { MetaContext, PageMeta } from "../feature/types.ts";
import { Redirecting } from "../shared/layout/redirecting.tsx";
import { SitePage } from "../shared/layout/site-layout.tsx";
import { absoluteUrl, buildMeta, consify } from "../shared/router.ts";
import { findPage, type PageData, pageParams } from "./find.ts";

/** `handle` of a page: the feature it belongs to (the search, the header use it). */
export function pageHandle(id: string) {
  return { page: id };
}

/**
 * `clientLoader` of a page, which runs when the visitor goes to the page (not on the first load).
 * The data of the page does not hold its text, only where to get it: the text is loaded here, so the
 * page is shown whole at once.
 */
export function pageClientLoader() {
  return async ({ serverLoader }: { serverLoader: () => Promise<unknown> }) => {
    const data = await serverLoader();
    await preloadMdx(data);
    return data;
  };
}

/** `meta` of a page: its `meta`, else `title` and `description`, else the feature and the site. */
export function pageMeta(id: string, key: string) {
  return ({ loaderData, params, location }: MetaArgs) => {
    const loaded = loaderData as PageData | undefined;
    if (!loaded || loaded.redirectTo !== undefined) return [];
    const { feature, page } = findPage(consify, id, key);
    if (page.kind !== "page") return [];
    const { config } = consify;
    const { lang } = loaded;
    const context: MetaContext = {
      data: loaded.data,
      lang,
      params: pageParams(params),
      t: createTranslate(config, lang, feature),
    };
    const text = (value: typeof page.title) =>
      typeof value === "function" ? value(context as never) : value;
    // what the page says, else what core knows of its entry
    // an explicit `undefined` from the page must not erase the value of the entry
    const own: PageMeta = { ...loaded.meta };
    for (const [name, value] of Object.entries(page.meta?.(context as never) ?? {})) {
      if (value !== undefined) (own as Record<string, unknown>)[name] = value;
    }
    const title =
      own.title ?? text(page.title) ?? featureText(config, lang, feature.title, feature);
    const site = config.site.name;
    return [
      ...buildMeta({
        lang,
        title: title && title !== site ? `${title} | ${site}` : site,
        description: own.description ?? text(page.description) ?? config.site.description,
        // a pre-rendered page is served as `/x/`, its address is `/x`
        path: own.canonical ?? (location.pathname.replace(/(.)\/+$/, "$1") || "/"),
        alternates: own.alternates,
        image: own.image,
      }),
      ...(own.head ?? []),
      // every page of a feature with a feed announces it
      ...(feature.content?.rss
        ? [
            {
              tagName: "link",
              rel: "alternate",
              type: "application/rss+xml",
              href: absoluteUrl(`${featureUrl(feature, lang)}/rss.xml`),
            },
          ]
        : []),
    ];
  };
}

/** The component of a route: the page of the feature inside the header and footer of the site. */
export function pageComponent(id: string, key: string) {
  return function FeaturePage({
    loaderData,
    params,
  }: {
    loaderData: PageData;
    params: Readonly<Record<string, string | undefined>>;
  }) {
    const { lang } = loaderData;
    const t = useMemo(() => createTranslate(consify.config, lang, consify.feature(id)), [lang]);
    if (loaderData.redirectTo !== undefined) return <Redirecting to={loaderData.redirectTo} />;
    const { page } = findPage(consify, id, key);
    if (page.kind !== "page") return null;
    const Component = page.component;
    const body = (
      <Component data={loaderData.data as never} lang={lang} params={pageParams(params)} t={t} />
    );
    const layout = page.layout ?? "site";
    if (layout === "none") return body;
    return (
      <SitePage consify={consify} lang={lang} page={id} sidebar={layout === "sidebar"}>
        {body}
      </SitePage>
    );
  };
}
