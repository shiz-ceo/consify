export * from "./config/index.ts";
export {
  type Blog,
  type BlogCollection,
  type BlogEntry,
  createBlog,
} from "./features/blog/blog.ts";
export { type BlogPost } from "./features/blog/posts.ts";
export { type PostFrontmatter, postFrontmatterSchema } from "./features/blog/schema.ts";
export {
  createHome,
  type HomeEntry,
  homeFrontmatterSchema,
  type MdxHome,
} from "./features/home/mdx-home.ts";
export { type DocsPlugin, definePlugin } from "./plugins/index.ts";
export {
  type Consify,
  componentsFromGlob,
  createConsify,
  type DocsCollection,
  type DocsEntry,
  type DocsPageData,
} from "./shared/instance.ts";
export { resolveHref } from "./shared/links.ts";
export { format, getMessages, type MessageKey, type Messages } from "./shared/messages.ts";
export {
  type FooterSlotProps,
  type HeaderSlotProps,
  type HomeSlotProps,
  type LayoutLink,
  type Slots,
  slotsFromGlob,
} from "./shared/slots.ts";
export { defaultDocsPath, deprecationOf, versionFromSlug } from "./shared/versions.ts";

export const version = "0.1.0";
