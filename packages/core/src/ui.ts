// The parts of the site for a page that draws its own layout (`layout: "none"`, the docs) or a
// component that needs the site. Only the site's own bundles load it: it reads the site from the
// generated `.consify/instance.ts`.

export { Footer } from "./shared/layout/footer.tsx";
export { docsLayoutOptions, headerLinks } from "./shared/layout/layout-options.tsx";
export { Redirecting } from "./shared/layout/redirecting.tsx";
export { useSidebarCollapsed } from "./shared/layout/sidebar-state.tsx";
export { SitePage } from "./shared/layout/site-layout.tsx";
export { absoluteUrl, buildMeta, consify, isStatic, requireLang } from "./shared/router.ts";
// The component itself; `FallbackNotice` of `@consify/core` is a lazy wrapper for the main entry.
export { FallbackNotice } from "./shared/ui/fallback-notice.tsx";
export { Features, type FeaturesProps, Hero, type HeroProps } from "./shared/ui/home-parts.tsx";
export { MdxImage } from "./shared/ui/media.tsx";
export { SearchField } from "./shared/ui/search-field.tsx";
export { SiteLink } from "./shared/ui/site-link.tsx";
export { useMessages } from "./shared/use-messages.ts";
