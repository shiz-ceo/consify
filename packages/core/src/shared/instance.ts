import type { MDXComponents } from "mdx/types";
import type { DocsConfig } from "../config/index.ts";
import { allFeatures } from "../feature/builtin.ts";
import type { Feature, FeatureSearch } from "../feature/types.ts";
import type { Locale } from "../locales/index.ts";
import { registerLocales } from "../locales/registry.ts";
import { fumadocsI18n } from "./i18n.ts";
import type { Slots } from "./slots.ts";

/** What the project has in `custom/`, found by the generated `.consify/instance.ts`. */
export interface ProjectFiles {
  /** `custom/components/*.tsx`: MDX components by file name. */
  components?: Record<string, unknown>;
  /** `custom/header.tsx`, `custom/footer.tsx`. */
  slots?: Slots;
  /** `custom/locales/<language>.ts`: the strings of the interface. */
  locales?: Record<string, Locale>;
}

/** Everything the site needs at runtime, built from the validated config. */
export function createConsify(config: Readonly<DocsConfig>, project: ProjectFiles = {}) {
  registerLocales(config, project.locales ?? {});
  const i18n = fumadocsI18n(config);

  // slots from `docs.config.ts` win over the files in `custom/`
  const fromConfig = config.slots ?? {};
  const slots: Slots = {
    ...project.slots,
    ...(fromConfig.header ? { Header: fromConfig.header } : {}),
    ...(fromConfig.headerEnd ? { HeaderEnd: fromConfig.headerEnd } : {}),
    ...(fromConfig.footer ? { Footer: fromConfig.footer } : {}),
  };

  const features = allFeatures(config);

  /** A feature of the site by id. */
  function feature(id: string): Feature {
    const found = features.find((candidate) => candidate.id === id);
    if (!found) throw new Error(`consify: there is no feature "${id}" in docs.config.ts`);
    return found;
  }

  // later wins: plugins, features, the config, `custom/components` (the built-in ones come first,
  // added by the root layout: importing them here would make a cycle through the site instance)
  const mdxComponents = {
    ...Object.assign({}, ...config.mdx.plugins.map((plugin) => plugin.components ?? {})),
    ...Object.assign({}, ...features.map((f) => f.components)),
    ...config.mdx.components,
    ...project.components,
  } as MDXComponents;

  const searches: Record<string, FeatureSearch> = Object.fromEntries(
    features.flatMap((f) => (f.search ? [[f.id, f.search]] : [])),
  );

  return { config, i18n, slots, features, feature, mdxComponents, searches };
}

export type Consify = ReturnType<typeof createConsify>;

/**
 * Turns the result of `import.meta.glob("/custom/components/*.{tsx,jsx}", { eager: true })` into a
 * component map: file name = tag name (PascalCase), default export = component.
 */
export function componentsFromGlob(modules: Record<string, unknown>): Record<string, unknown> {
  const components: Record<string, unknown> = {};
  for (const [path, mod] of Object.entries(modules)) {
    const name = /([A-Z][A-Za-z0-9]*)\.(?:tsx|jsx)$/.exec(path)?.[1];
    const component = (mod as { default?: unknown } | null)?.default;
    if (name && component) components[name] = component;
  }
  return components;
}
