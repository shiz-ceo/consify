import { type CSSProperties, lazy, Suspense, useEffect, useRef, useState } from "react";
import { Footer } from "../../../shared/layout/footer.tsx";
import { SiteLayout } from "../../../shared/layout/site-layout.tsx";
import { buildMeta, consify, requireLang } from "../../../shared/router.ts";

const ScalarReference = lazy(() => import("../scalar-reference.tsx"));

type Params = Record<string, string | undefined>;
type Source = { url: string } | { content: string };

/** The API reference is Scalar itself, on its own page. */
export async function loader({
  params,
}: {
  params: Params;
}): Promise<{ lang: string; source: Source }> {
  const lang = requireLang(params);
  const input = [consify.config.openapi?.input ?? []].flat()[0];
  if (!input) throw new Response("Not found", { status: 404 });

  // Server only: removed from the browser bundle together with the loader.
  if (/^https?:\/\//.test(input)) return { lang, source: { url: input } };
  const { readFile } = await import("node:fs/promises");
  const { resolve } = await import("node:path");
  return { lang, source: { content: await readFile(resolve(process.cwd(), input), "utf8") } };
}

export function meta({ loaderData }: { loaderData?: { lang: string } }) {
  const lang = loaderData?.lang ?? consify.i18n.defaultLanguage;
  return buildMeta({
    lang,
    title: consify.config.openapi?.title ?? "API",
    description: consify.config.site.description,
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

  // The footer overlaps the bottom of Scalar's content, which is padded by the footer's height
  // (`scalar.css`), so that the sidebar of Scalar keeps going down beside the footer.
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  useEffect(() => {
    const node = footerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setFooterHeight(node.offsetHeight));
    observer.observe(node);
    setFooterHeight(node.offsetHeight);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <SiteLayout
      consify={consify}
      lang={loaderData.lang}
      sidebarToggle
      footer={false}
      page="api-reference"
    >
      <div
        className="consify-api flex flex-1 flex-col"
        style={{ "--consify-footer-h": `${footerHeight}px` } as CSSProperties}
      >
        <div className="min-h-[70vh] flex-1">
          {mounted ? (
            <Suspense fallback={null}>
              <ScalarReference source={loaderData.source} />
            </Suspense>
          ) : null}
        </div>
        {mounted ? (
          <div ref={footerRef} className="consify-api-footer">
            <div className="consify-api-footer-inner">
              <Footer consify={consify} lang={loaderData.lang} variant="compact" />
            </div>
          </div>
        ) : null}
      </div>
    </SiteLayout>
  );
}
