// Everything a feature and `docs.config.ts` need. Node loads this module with `docs.config.ts`,
// so nothing here may use JSX or import a stylesheet.

import { lazy } from "react";

/** Zod, for the `schema` of content and the options of a feature package. */
export { z } from "zod";
export * from "./config/index.ts";
export type { Head, HeadInput } from "./config/schema.ts";
export {
  type AnchorLevel,
  type AnchorsConfig,
  type AnchorsOptions,
  anchorRules,
} from "./content/anchor-rules.ts";
export { Mdx, type MdxProps } from "./content/mdx.ts";
export { previewsPath } from "./feature/content-files.ts";
export { defineFeature, isFeature, page } from "./feature/define.ts";
export { lazyComponents } from "./feature/lazy.ts";
export { featureUrl, fillUrl } from "./feature/paths.ts";
export { featureText } from "./feature/text.ts";
export { createTranslate } from "./feature/translate.ts";
export type {
  Content,
  ContentFile,
  ContentOptions,
  Entry,
  EntryPage,
  Feature,
  FeatureInput,
  FeatureSearch,
  FeatureText,
  FileBody,
  FileDefinition,
  HeadTag,
  LinkOption,
  LinksContext,
  LoadContext,
  Localized,
  MdxFile,
  MetaContext,
  PageDefinition,
  PageInput,
  PageLayout,
  PageMeta,
  PageProps,
  Params,
  PathsContext,
  RedirectDefinition,
  Schema,
  SearchContext,
  SearchResult,
  SearchState,
  Strings,
  TocItem,
  Translate,
} from "./feature/types.ts";
export { builtinLocales, defineLocale, type Locale, type UiKey } from "./locales/index.ts";
export { type DocsPlugin, definePlugin } from "./plugins/index.ts";
export { linkCatalog, linkIds, primaryLinks } from "./shared/catalog.ts";
export {
  completeMetaPages,
  fallbackBadgePlugin,
  languageLabel,
} from "./shared/fallback.ts";
export { fumadocsI18n } from "./shared/i18n.ts";
export { resolveHref } from "./shared/links.ts";
export { localized } from "./shared/localized.ts";
export {
  type CoreMessages,
  coreMessageKeys,
  featureMessageKeys,
  format,
  getMessages,
  type MessageKey,
  type Messages,
  type MessagesOf,
} from "./shared/messages.ts";
export type {
  LeafLinkItem,
  LinkItem,
  MenuLinkItem,
  ResolvedItem,
  ResolvedLink,
  ResolvedMenu,
  Text,
} from "./shared/nav.ts";
export type { FooterSlotProps, HeaderSlotProps, LayoutLink, Slots } from "./shared/slots.ts";

/**
 * The note on a page shown without a translation (`entry.fallback`), with a link to `original`.
 * Loaded when first drawn, so a feature file can use it. `@consify/core/ui` exports the same
 * component directly, for code that only the site's own bundles load.
 *
 * @example
 * {data.fallback ? <FallbackNotice original={data.original} /> : null}
 */
export const FallbackNotice = lazy(() =>
  import("./shared/ui/fallback-notice.tsx").then((m) => ({ default: m.FallbackNotice })),
);

/** The version of `@consify/core`. */
export const version = "1.1.0";
