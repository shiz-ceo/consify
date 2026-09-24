import type { DocsConfig } from "../config/index.ts";

export type FeatureConfig = Readonly<DocsConfig>;

/** A route of a feature. `file` is relative to the feature folder. */
export interface RouteSpec {
  /** URL pattern in React Router syntax. Omitted for the index route. */
  path?: string;
  index?: boolean;
  file: string;
}

export interface NavLink {
  text: string;
  url: string;
}

export interface RouteContext {
  /** `deploy.mode` is `static`: a single-page app, so routes cannot have loaders unless pre-rendered. */
  isStatic: boolean;
}

/**
 * A piece of the site (docs, blog, API reference …). Everything that knows about the piece lives
 * in its folder; the routes, the navigation, the pre-render list and the sitemap ask the features
 * instead of naming them. This file is loaded by the browser bundle too, so it must not import
 * Node modules. What needs Node (reading files for pre-render) goes to `prerender.ts`.
 */
export interface Feature {
  id: string;
  /** `import.meta.url` of the feature's `feature.ts`: routes are resolved from its folder. */
  dir: string;
  /** Whether the feature is on for this config. Default: always. */
  enabled?: (config: FeatureConfig) => boolean;
  routes: (context: RouteContext) => RouteSpec[];
  /** The link in the top navigation. */
  nav?: (config: FeatureConfig, lang: string) => NavLink | undefined;
}

/** Runs at build time (Node): the URLs of the feature to pre-render. */
export type PrerenderPaths = (config: FeatureConfig, cwd: string) => string[];
