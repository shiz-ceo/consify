export * from "./config/index.ts";
export {
  componentsFromGlob,
  createDocsivi,
  type DocsCollection,
  type DocsEntry,
  type Docsivi,
  type DocsPageData,
} from "./instance.ts";
export { format, getMessages, type MessageKey, type Messages } from "./messages.ts";
export { type DocsPlugin, definePlugin } from "./plugins/index.ts";
export { defaultDocsPath, deprecationOf, versionFromSlug } from "./versions.ts";

export const version = "0.0.0";
