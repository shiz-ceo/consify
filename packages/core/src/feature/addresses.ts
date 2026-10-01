// Every address the features of a site have, with their parameters filled in. Pre-render, the
// sitemap and the route list of a static site come from here. Runs on the server (reads content).

import type { DocsConfig } from "../config/index.ts";
import { type ContentSource, createContent } from "../content/files.ts";
import { allFeatures } from "./builtin.ts";
import { contentFiles } from "./content-files.ts";
import { fillUrl, keyParams } from "./paths.ts";
import type { Feature, Params } from "./types.ts";

export interface Address {
  feature: Feature;
  key: string;
  kind: "page" | "redirect" | "file";
  lang: string;
  url: string;
  /** A page of an entry that is not translated: a copy of the original, left out of the sitemap. */
  copy?: boolean;
}

/** The parameters of the page `key` for an entry: `{ "*": "v2/guide" }` or `{ slug: "hello" }`. */
export function entryParams(key: string, slug: string): Record<string, string> {
  const names = keyParams(key);
  const name = names.includes("*") ? "*" : names[0];
  return name ? { [name]: slug } : {};
}

/** Every address of the site, per feature, key and language. */
export async function siteAddresses(
  config: Readonly<DocsConfig>,
  cwd: string = process.cwd(),
  source?: ContentSource,
): Promise<Address[]> {
  const addresses: Address[] = [];
  for (const feature of allFeatures(config)) {
    for (const lang of config.i18n.languages) {
      const context = {
        lang,
        config,
        content: createContent({ config, cwd, feature, lang, source }),
      };
      const expand = async (
        key: string,
        kind: Address["kind"],
        paths?: (c: typeof context) => readonly Params[] | Promise<readonly Params[]>,
        copies?: ReadonlySet<string>,
      ) => {
        // an address without parameters exists once, one with parameters as often as `paths` says
        const list = paths ? await paths(context) : keyParams(key).length === 0 ? [{}] : [];
        for (const params of list) {
          const url = fillUrl(feature, key, lang, params);
          addresses.push({
            feature,
            key,
            kind,
            lang,
            url,
            ...(copies?.has(url) ? { copy: true } : {}),
          });
        }
      };
      const entries = async () => (feature.content ? context.content.entries() : []);
      for (const [key, page] of Object.entries(feature.pages)) {
        if (page.kind === "redirect") await expand(key, "redirect");
        else if (page.entry && !page.paths) {
          // a page of an entry exists for every entry
          const all = await entries();
          const copies = new Set(all.filter((e) => e.fallback).map((e) => e.url));
          await expand(key, "page", async () => all.map((e) => entryParams(key, e.slug)), copies);
        } else await expand(key, "page", page.paths);
      }
      for (const [key, file] of Object.entries(feature.files)) {
        await expand(key, "file", file.paths);
      }
      for (const [key, kind] of Object.entries(contentFiles(feature))) {
        // a server answers every query of the search; only a static site needs its index as a file
        if (kind === "search" && config.deploy.mode !== "static") continue;
        await expand(
          key,
          "file",
          kind === "og"
            ? async () => (await entries()).map((e) => ({ "*": `${e.slug || "index"}.png` }))
            : undefined,
        );
      }
    }
  }
  return addresses;
}
