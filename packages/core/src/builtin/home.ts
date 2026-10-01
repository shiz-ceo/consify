// No JSX here: the CLI reads the pages of the site in Node, which loads this module.
import { createElement } from "react";
import { Mdx } from "../content/mdx.ts";
import { defineFeature, page } from "../feature/define.ts";
import { primaryLinks } from "../shared/catalog.ts";

interface HomeFrontmatter {
  title?: string;
  description?: string;
}

/**
 * The front page of the site (`/{lang}`): `content/<language>/home.mdx`, with `<Hero />` and
 * `<Features />` among its components. Without it the reader is sent to the first feature. A
 * feature of the project with `path: ""` replaces it.
 */
export const home = defineFeature({
  id: "home",
  path: "",
  folder: "",
  pages: {
    "/": page({
      // a redirect stays a real HTTP redirect on a server: only a page, or a static site, is pre-rendered
      paths: async ({ content, config }) =>
        config.deploy.mode === "static" || (await content.read("home.mdx")) !== undefined
          ? [{}]
          : [],
      load: async ({ content, config, lang, redirect, notFound }) => {
        const file = await content.mdx<HomeFrontmatter>("home.mdx");
        if (file) return file;
        const first = primaryLinks(config, lang)[0];
        return first ? redirect(first.url) : notFound();
      },
      title: ({ data }) => data.frontmatter.title,
      description: ({ data }) => data.frontmatter.description,
      component: ({ data }) =>
        createElement(
          "main",
          { className: "mx-auto w-full max-w-6xl flex-1 px-6 py-16 md:py-24" },
          createElement(Mdx, { code: data.code }),
        ),
    }),
  },
});
