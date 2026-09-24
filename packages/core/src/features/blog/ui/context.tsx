import { createContext, useContext } from "react";

export interface BlogAuthor {
  name: string;
  role?: string | undefined;
  avatar?: string | undefined;
  url?: string | undefined;
}

export interface BlogContextValue {
  authors: Record<string, BlogAuthor>;
  /** `owner/name` of the GitHub repository, used by <PR />. */
  repo?: string | undefined;
  /** Turns a site link such as `/docs` into a URL of the current language. */
  resolve?: ((href: string) => string) | undefined;
}

const BlogContext = createContext<BlogContextValue>({ authors: {} });

/** Gives the components used inside a post (`<Authors />`, `<PR />`) the data of the site. */
export const BlogProvider = BlogContext.Provider;

export function useBlog(): BlogContextValue {
  return useContext(BlogContext);
}
