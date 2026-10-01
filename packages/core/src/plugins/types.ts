import type { ComponentType } from "react";
import type { ShikiTransformer } from "shiki";
import type { Pluggable } from "unified";

/**
 * A consify plugin. Every field is optional, a plugin usually touches one area. Plugins are listed
 * in `docs.config.ts` (`mdx.plugins`) and applied in order, after the built-in behavior.
 */
export interface DocsPlugin {
  /** Unique name, used in error messages. */
  name: string;
  /** Remark plugins (Markdown → mdast), appended after the built-in ones. */
  remark?: Pluggable[];
  /** Rehype plugins (HTML tree), appended after the built-in ones. */
  rehype?: Pluggable[];
  /** Shiki additions for code blocks. */
  shiki?: {
    /** Appended after the built-in transformers. */
    transformers?: ShikiTransformer[];
    /** Languages to preload. */
    langs?: string[];
  };
  /** MDX components, available in `.mdx` files without imports. */
  components?: Record<string, ComponentType<never>>;
  /**
   * UI strings of the plugin per language, for the components it brings. Read them with
   * `getMessages`; `custom/locales` and `i18n.messages` win over them.
   */
  messages?: Record<string, Record<string, string>>;
}

/**
 * Identity helper that gives editor hints when writing a plugin. List the result in `mdx.plugins`.
 *
 * @example
 * import remarkGfm from "remark-gfm";
 * import { defineConfig, definePlugin } from "@consify/core";
 *
 * const gfm = definePlugin({ name: "gfm", remark: [remarkGfm] });
 *
 * export default defineConfig({ site: { name: "Docs" }, mdx: { plugins: [gfm] } });
 */
export function definePlugin(plugin: DocsPlugin): DocsPlugin {
  return plugin;
}
