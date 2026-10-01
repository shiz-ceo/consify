import { createFumadocsSearch } from "../shared/fumadocs-search.ts";
import { featureUrl } from "./paths.ts";
import type {
  Feature,
  FeatureInput,
  FileInput,
  FileRoute,
  MessageKeys,
  Page,
  PageDefinition,
  PageInput,
  Strings,
} from "./types.ts";

const idPattern = /^[a-z][a-z0-9-]*$/;
const pathPattern = /^(?:[a-z0-9][\w.-]*(?:\/[a-z0-9][\w.-]*)*)?$/i;

/** `"/"`, `"/:slug"`, `"/a/*"`: starts with `/`, no empty segments. */
function normalizeKey(feature: string, kind: string, key: string): string {
  if (!key.startsWith("/") || /\/\//.test(key) || (key.length > 1 && key.endsWith("/"))) {
    throw new Error(
      `defineFeature("${feature}"): the address "${key}" of ${kind} must start with "/" and not end with one`,
    );
  }
  return key;
}

function isPageObject(value: object): value is { component: unknown } | { redirect: unknown } {
  return "component" in value || "redirect" in value;
}

function normalizePage(feature: string, key: string, input: PageInput<unknown>): Page {
  if (typeof input === "object" && input !== null && isPageObject(input)) {
    if ("redirect" in input) return { kind: "redirect", redirect: input.redirect };
    return { kind: "page", ...(input as Omit<Extract<Page, { kind: "page" }>, "kind">) };
  }
  // a function component, or `lazy()` / `memo()` (objects React knows)
  if (typeof input === "function" || (typeof input === "object" && input !== null)) {
    return { kind: "page", component: input as never };
  }
  throw new Error(`defineFeature("${feature}"): the page "${key}" must be a component`);
}

function normalizeFile(feature: string, key: string, input: FileInput): FileRoute {
  if (typeof input === "function") return { load: input };
  if (typeof input === "object" && input !== null && typeof input.load === "function") return input;
  throw new Error(`defineFeature("${feature}"): the file "${key}" must be a function or { load }`);
}

/**
 * A page that loads data, with `data` typed from what `load` returns. A plain object works the
 * same, `data` is then untyped.
 *
 * @example
 * "/:service": page({
 *   load: ({ params }) => services.find((s) => s.id === params.service),
 *   component: ({ data }) => <h1>{data?.name}</h1>,
 * }),
 */
export function page<Data>(definition: PageDefinition<Data>): PageDefinition<Data> {
  return definition;
}

/**
 * A feature of the site: its pages are React components, it can read `content/<language>/<id>/`,
 * and it speaks every language of the site. List it in `features` of `docs.config.ts`.
 *
 * @example
 * export const status = defineFeature({
 *   id: "status",
 *   title: { en: "Status", ru: "Статус" },
 *   messages: { en: { up: "Up" }, ru: { up: "Работает" } },
 *   pages: {
 *     "/": ({ t }) => <p>{t("up")}</p>,
 *     "/:service": page({
 *       paths: () => services.map((s) => ({ service: s.id })),
 *       load: ({ params, notFound }) => services.find((s) => s.id === params.service) ?? notFound(),
 *       title: ({ data }) => data.name,
 *       component: ({ data }) => <h1>{data.name}</h1>,
 *     }),
 *   },
 * });
 */
export function defineFeature<
  const M extends Readonly<Record<string, Strings>> = Readonly<Record<string, Strings>>,
>(input: Omit<FeatureInput<MessageKeys<M>>, "messages"> & { messages?: M }): Feature {
  const { id } = input;
  if (typeof id !== "string" || !idPattern.test(id)) {
    throw new Error(
      `defineFeature: id "${String(id)}" must be lowercase letters, digits and \`-\`, and start with a letter`,
    );
  }
  const path = input.path ?? id;
  if (!pathPattern.test(path)) {
    throw new Error(`defineFeature("${id}"): path "${path}" must be a relative address, or ""`);
  }
  const pages = Object.fromEntries(
    Object.entries(input.pages ?? {}).map(([key, page]) => [
      normalizeKey(id, "a page", key),
      normalizePage(id, key, page as PageInput<unknown>),
    ]),
  );
  const files = Object.fromEntries(
    Object.entries(input.files ?? {}).map(([key, file]) => [
      normalizeKey(id, "a file", key),
      normalizeFile(id, key, file as FileInput),
    ]),
  );
  return Object.freeze({
    id,
    path,
    folder: input.folder ?? id,
    content: input.content,
    title: input.title as Feature["title"],
    description: input.description as Feature["description"],
    messages: input.messages ?? {},
    pages,
    files,
    links: input.links as Feature["links"],
    components: input.components ?? {},
    // content is searched by the search dialog, unless the feature brings its own search or says no
    search:
      input.search ??
      (input.content && input.content.search !== false
        ? createFumadocsSearch((lang) => `${featureUrl({ path }, lang)}/search.json`)
        : undefined),
  });
}

/** Whether a value is a feature made by `defineFeature`. */
export function isFeature(value: unknown): value is Feature {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Feature).id === "string" &&
    typeof (value as Feature).pages === "object" &&
    typeof (value as Feature).files === "object"
  );
}
