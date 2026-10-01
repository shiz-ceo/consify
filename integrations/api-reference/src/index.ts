import { defineFeature, type Localized } from "@consify/core";
import { lazy } from "react";

/** The page, loaded when it is shown: Node reads this module with `docs.config.ts`. */
const ApiPage = lazy(() => import("./page.tsx"));

export interface ApiReferenceOptions {
  /** The OpenAPI schema: a file of the project (`./openapi.json`) or a URL. */
  input: string;
  /** The title of the page and the text of its link in the header. */
  title?: Localized;
  /** The address (`/{lang}/<id>`) and link id. Set it for a second API reference. Default `api`. */
  id?: string;
}

/** The schema as Scalar takes it: its address, or its text. */
export type ApiSource = { url: string } | { content: string };

/**
 * An API reference generated from an OpenAPI schema (Scalar) on its own page, `/{lang}/api`.
 *
 * @example
 * features: [apiReference({ input: "./openapi.json" })]
 */
export function apiReference({ input, title = "API", id = "api" }: ApiReferenceOptions) {
  return defineFeature({
    id,
    title,
    description: {
      en: "Every endpoint, with a client to try it",
      ru: "Все методы, с клиентом для запросов",
    },
    pages: {
      "/": {
        layout: "sidebar",
        load: async ({ readFile }): Promise<ApiSource> =>
          /^https?:\/\//.test(input) ? { url: input } : { content: await readFile(input) },
        component: ApiPage,
      },
    },
    search: { open: openScalarSearch },
  });
}

/**
 * The search field of the site opens the search of Scalar by clicking its hidden button (Scalar has
 * no API for it). `false` when the button is not there yet.
 */
function openScalarSearch(): boolean {
  const button =
    document.querySelector<HTMLButtonElement>(
      ".scalar-app .t-doc__sidebar button.bg-sidebar-b-search",
    ) ??
    [...document.querySelectorAll<HTMLButtonElement>(".scalar-app button")].find((b) =>
      /search/i.test(b.textContent ?? ""),
    );
  button?.click();
  return button !== undefined;
}
