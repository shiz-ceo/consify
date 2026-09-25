// `consify:instance` is an alias (set by the consify Vite plugin) to `.consify/instance.ts` of the project.
declare module "consify:instance" {
  import type { Consify } from "consify";
  export const consify: Consify;
}

// `consify:blog` is an alias to `.consify/blog.ts`: the posts of the blog, or `null` when it is off.
declare module "consify:blog" {
  import type { Blog } from "consify";
  export const blog: Blog | null;
}

// `consify:home` is an alias to `.consify/home.ts`: the home page written in MDX, or `null`.
declare module "consify:home" {
  import type { MdxHome } from "consify";
  export const home: MdxHome | null;
}
