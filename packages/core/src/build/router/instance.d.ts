// `consify:instance` is an alias (set by the consify Vite plugin) to `.consify/instance.ts` of the project.
declare module "consify:instance" {
  import type { Consify } from "@consify/core/runtime";
  export const consify: Consify;
}

// `consify:content` is an alias to `.consify/content.ts`: the text files of `content/` and the files of
// the snippets, for the server build.
declare module "consify:content" {
  export const content: Record<string, () => Promise<unknown>>;
  export const snippets: Record<string, () => Promise<unknown>>;
}
