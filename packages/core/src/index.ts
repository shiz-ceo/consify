export { type Blog, type BlogCollection, type BlogEntry, createBlog } from "./blog/blog.ts";
export { type BlogPost } from "./blog/posts.ts";
export { type PostFrontmatter, postFrontmatterSchema } from "./blog/schema.ts";
export * from "./config/index.ts";
export {
  componentsFromGlob,
  createDocsivi,
  type DocsCollection,
  type DocsEntry,
  type Docsivi,
  type DocsPageData,
} from "./instance.ts";
export { resolveHref } from "./links.ts";
export { format, getMessages, type MessageKey, type Messages } from "./messages.ts";
export { type DocsPlugin, definePlugin } from "./plugins/index.ts";
export { defaultDocsPath, deprecationOf, versionFromSlug } from "./versions.ts";

export const version = "0.0.0";
