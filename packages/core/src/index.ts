export * from "./config/index.ts";
export {
  type Blog,
  type BlogCollection,
  type BlogEntry,
  createBlog,
} from "./features/blog/blog.ts";
export { type BlogPost } from "./features/blog/posts.ts";
export { type PostFrontmatter, postFrontmatterSchema } from "./features/blog/schema.ts";
export { type DocsPlugin, definePlugin } from "./plugins/index.ts";
export {
  componentsFromGlob,
  createDocsivi,
  type DocsCollection,
  type DocsEntry,
  type Docsivi,
  type DocsPageData,
} from "./shared/instance.ts";
export { resolveHref } from "./shared/links.ts";
export { format, getMessages, type MessageKey, type Messages } from "./shared/messages.ts";
export { defaultDocsPath, deprecationOf, versionFromSlug } from "./shared/versions.ts";

export const version = "0.0.0";
