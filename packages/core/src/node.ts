// What the CLI and tests use: loading the config, the addresses of the site, content.

export { loadConfig } from "./build/load-config.ts";
export { prerenderPaths } from "./build/router/prerender.ts";
export { packageDirs } from "./build/router/scaffold.ts";
export {
  type AnchorDiagnostic,
  type AnchorPage,
  type AnchorsConfig,
  type AnchorsInput,
  anchorRules,
  checkAnchors,
  type Heading,
  headingsOf,
  idsOf,
  linksOf,
  plainHeading,
  type Registry,
  registryKey,
  resolveLink,
  transliterate,
  validId,
} from "./content/anchors.ts";
export { compileMdx, splitFrontmatter } from "./content/compile.ts";
export {
  bundledSource,
  type ContentSource,
  contentDir,
  createContent,
  diskSource,
  slugOf,
} from "./content/files.ts";
export { type Address, siteAddresses } from "./feature/addresses.ts";
export { allFeatures } from "./feature/builtin.ts";
export { createLoadContext, type LoadContextOptions } from "./feature/load-context.ts";
export { renderLocaleTemplate, warnMissingLocales } from "./locales/template.ts";
