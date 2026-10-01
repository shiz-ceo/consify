import type { DocsConfig } from "../config/index.ts";
import { featureUrl } from "../feature/paths.ts";
import { featureText } from "../feature/text.ts";
import { createTranslate } from "../feature/translate.ts";
import type { LinkOption } from "../feature/types.ts";

/**
 * Every place the features offer to link to, in the order of the features: the front page of every
 * feature that has a `title`, then what its `links` add.
 */
export function linkCatalog(config: Readonly<DocsConfig>, lang: string): LinkOption[] {
  return config.features.flatMap((feature) => {
    const title = featureText(config, lang, feature.title, feature);
    const front: LinkOption[] = title
      ? [
          {
            id: feature.id,
            title,
            description: featureText(config, lang, feature.description, feature),
            url: featureUrl(feature, lang),
            primary: true,
          },
        ]
      : [];
    const t = createTranslate(config, lang, feature);
    // the entries as text for AI agents
    const llms: LinkOption[] = feature.content?.llms
      ? [
          {
            id: `${feature.id}:llms`,
            title: "llms.txt",
            description: t("llmsHint"),
            url: `${featureUrl(feature, lang)}/llms.txt`,
          },
        ]
      : [];
    const rss: LinkOption[] = feature.content?.rss
      ? [
          {
            id: `${feature.id}:rss`,
            title: "RSS",
            description: t("rssHint"),
            url: `${featureUrl(feature, lang)}/rss.xml`,
            external: true,
          },
        ]
      : [];
    return [...front, ...llms, ...rss, ...(feature.links?.({ lang, t, config }) ?? [])];
  });
}

/** The ids of the catalog. They do not depend on the language, the default one is asked. */
export function linkIds(config: Readonly<DocsConfig>): string[] {
  return linkCatalog(config, config.i18n.defaultLanguage).map((option) => option.id);
}

/** What the header and the footer show when the site does not choose: the main places. */
export function primaryLinks(config: Readonly<DocsConfig>, lang: string): LinkOption[] {
  return linkCatalog(config, lang).filter((option) => option.primary);
}
