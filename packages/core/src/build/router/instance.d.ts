// `docsivi:instance` is an alias (set by the docsivi Vite plugin) to `.docsivi/instance.ts` of the project.
declare module "docsivi:instance" {
  import type { Docsivi } from "docsivi";
  export const docsivi: Docsivi;
}

// `docsivi:blog` is an alias to `.docsivi/blog.ts`: the posts of the blog, or `null` when it is off.
declare module "docsivi:blog" {
  import type { Blog } from "docsivi";
  export const blog: Blog | null;
}

// `docsivi:home` is an alias to `.docsivi/home.ts`: the home page written in MDX, or `null`.
declare module "docsivi:home" {
  import type { MdxHome } from "docsivi";
  export const home: MdxHome | null;
}
