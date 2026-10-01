// The context `load` of a page or a file gets: the server builds it for every request, a test of a
// feature builds it the same way.
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { DocsConfig } from "../config/index.ts";
import { type ContentSource, createContent } from "../content/files.ts";
import { createTranslate } from "./translate.ts";
import type { Feature, LoadContext, Params } from "./types.ts";

/** Thrown by `redirect()` of a load function; the server turns it into a redirect. */
export class RedirectSignal {
  readonly to: string;
  constructor(to: string) {
    this.to = to;
  }
}

export interface LoadContextOptions {
  config: Readonly<DocsConfig>;
  feature: Feature;
  lang: string;
  params?: Params;
  request?: Request;
  /** The project folder. Default: the current folder. */
  cwd?: string;
  /** Where the content comes from: `content/` of `cwd` on the disk by default. */
  source?: ContentSource | undefined;
}

/**
 * The context of `load` for a feature in a language.
 *
 * @example
 * const context = createLoadContext({ config, feature: status, lang: "en", params: { service: "api" } });
 * await status.pages["/:service"].load(context);
 */
export function createLoadContext(options: LoadContextOptions): LoadContext {
  const { config, feature, lang } = options;
  const cwd = options.cwd ?? process.cwd();
  const { url, basePath } = { url: config.site.url, basePath: config.deploy.basePath ?? "" };
  return {
    lang,
    params: options.params ?? {},
    t: createTranslate(config, lang, feature),
    content: createContent({ config, cwd, feature, lang, source: options.source }),
    readFile: (path) => {
      const file = resolve(cwd, path);
      const inside = relative(cwd, file);
      if (inside.startsWith("..") || isAbsolute(inside)) {
        throw new Error(`readFile: "${path}" is outside of the project`);
      }
      return readFile(file, "utf8");
    },
    config,
    request: options.request ?? new Request(`http://localhost/${lang}`),
    url: (path) => (url ? new URL(`${basePath}${path}`, url).toString() : path),
    notFound: () => {
      throw new Response("Not found", { status: 404 });
    },
    redirect: (to) => {
      throw new RedirectSignal(to);
    },
  };
}
