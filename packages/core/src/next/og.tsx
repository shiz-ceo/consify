import { generateOGImage } from "fumadocs-ui/og";
import { notFound } from "next/navigation";
import type { Docsivi } from "../instance.ts";

type OgContext = { params: Promise<{ lang: string; slug: string[] }> };

/** Path of the OG image of a page: `/{lang}/og/{...slugs}/image.png`. */
export function ogImagePath(lang: string, slugs: readonly string[]): string {
  return `/${lang}/og/${[...slugs, "image.png"].join("/")}`;
}

/** Route handler for `app/[lang]/og/[...slug]/route.tsx`. The last segment is `image.png`. */
export function createOgRoute({ config, source }: Docsivi) {
  async function GET(_: Request, ctx: OgContext) {
    const { lang, slug } = await ctx.params;
    const page = source.getPage(slug.slice(0, -1), lang);
    if (!page || !config.features.og) notFound();
    return generateOGImage({
      title: page.data.title,
      description: page.data.description,
      site: config.site.name,
    });
  }

  function generateStaticParams() {
    return source.getPages().map((page) => ({
      lang: page.locale,
      slug: [...page.slugs, "image.png"],
    }));
  }

  return { GET, generateStaticParams };
}
