import { HomeLayout } from "fumadocs-ui/layouts/home";
import { lazy, Suspense, useEffect, useState } from "react";
import { baseOptions } from "../../layout-options.tsx";
import { buildMeta, docsivi, requireLang } from "../shared.ts";

const ScalarReference = lazy(() => import("../../components/scalar-reference.tsx"));

type Params = Record<string, string | undefined>;
type Source = { url: string } | { content: string };

/** The API reference is Scalar itself, on its own page. */
export async function loader({
  params,
}: {
  params: Params;
}): Promise<{ lang: string; source: Source }> {
  const lang = requireLang(params);
  const input = [docsivi.config.openapi?.input ?? []].flat()[0];
  if (!input) throw new Response("Not found", { status: 404 });

  // Server only: removed from the browser bundle together with the loader.
  if (/^https?:\/\//.test(input)) return { lang, source: { url: input } };
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  return { lang, source: { content: await readFile(resolve(process.cwd(), input), "utf8") } };
}

export function meta({ loaderData }: { loaderData?: { lang: string } }) {
  const lang = loaderData?.lang ?? docsivi.i18n.defaultLanguage;
  return buildMeta({
    lang,
    title: docsivi.config.openapi?.title ?? "API",
    description: docsivi.config.site.description,
    path: `/${lang}/api`,
  });
}

export default function ApiScalarRoute({
  loaderData,
}: {
  loaderData: { lang: string; source: Source };
}) {
  // Scalar needs the browser: render it after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <HomeLayout {...baseOptions(docsivi, loaderData.lang)}>
      <div className="min-h-[70vh] flex-1">
        {mounted ? (
          <Suspense fallback={null}>
            <ScalarReference source={loaderData.source} />
          </Suspense>
        ) : null}
      </div>
    </HomeLayout>
  );
}
