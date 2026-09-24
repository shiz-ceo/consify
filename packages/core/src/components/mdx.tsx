import * as Twoslash from "fumadocs-twoslash/ui";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Banner } from "fumadocs-ui/components/banner";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { DocsConfig } from "../config/index.ts";
import { Badge } from "./badge.tsx";
import { Mermaid } from "./mermaid.tsx";
import { Video } from "./video.tsx";

/** Components available in every `.mdx` file without imports. */
export const builtinComponents = {
  ...defaultMdxComponents,
  ...Twoslash,
  Accordion,
  Accordions,
  Badge,
  Banner,
  File,
  Files,
  Folder,
  Mermaid,
  Step,
  Steps,
  Tab,
  Tabs,
  TypeTable,
  Video,
} satisfies MDXComponents;

/**
 * Component map for MDX, later entries win:
 * built-ins, components from plugins, components from `docs.config.ts`, components discovered in
 * `custom/components`, per-page overrides.
 */
export function getMDXComponents(
  config: Readonly<DocsConfig>,
  overrides: MDXComponents = {},
  discovered: Record<string, unknown> = {},
): MDXComponents {
  return {
    ...builtinComponents,
    ...Object.assign({}, ...config.plugins.map((p) => p.components ?? {})),
    ...(config.components as MDXComponents),
    ...(discovered as MDXComponents),
    ...overrides,
  };
}
