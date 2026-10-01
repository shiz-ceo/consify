// The server half of a page or a file of a feature: its loader. Only the server bundle has it
// (React Router removes `loader` from the browser bundle, and this module with it).
/// <reference path="../build/router/instance.d.ts" />
import { content as bundled } from "consify:content";
import { redirect } from "react-router";
import { llmsText, ogImage, rssText, searchResponse } from "../content/collection.ts";
import { bundledSource } from "../content/files.ts";
import { type ContentFileKind, ogImagePath } from "../feature/content-files.ts";
import { createLoadContext, RedirectSignal } from "../feature/load-context.ts";
import { featureUrl } from "../feature/paths.ts";
import { featureText } from "../feature/text.ts";
import type { EntryPage, Feature, FileBody, LoadContext, PageMeta } from "../feature/types.ts";
import { consify, isStatic, requireLang } from "../shared/router.ts";
import { findFile, findPage, type PageData, pageParams } from "./find.ts";

interface LoaderArgs {
  params: Readonly<Record<string, string | undefined>>;
  request: Request;
}

/**
 * Where a running site reads its content: the server build once it is built, the disk while it is
 * edited (a file saved there shows at once).
 */
export const contentSource = import.meta.env.PROD ? bundledSource(bundled) : undefined;

function loadContext(feature: Feature, lang: string, args: LoaderArgs): LoadContext {
  return createLoadContext({
    source: contentSource,
    config: consify.config,
    feature,
    lang,
    params: pageParams(args.params),
    request: args.request,
  });
}

/** The `<head>` of the page of an entry: its title and description, translations, social image. */
function entryMeta(feature: Feature, entry: EntryPage, lang: string): PageMeta {
  const text = (key: string) =>
    typeof entry.data[key] === "string" ? (entry.data[key] as string) : undefined;
  return {
    title: text("title"),
    description: text("description"),
    alternates: entry.alternates,
    // a page shown without a translation is a copy: the original is its canonical address
    canonical: entry.fallback ? entry.original : entry.url,
    ...(feature.content?.og ? { image: ogImagePath(featureUrl(feature, lang), entry.slug) } : {}),
  };
}

/** A redirect: an HTTP one on a server, a page that redirects itself on a static site. */
function redirectTo(lang: string, to: string): PageData {
  if (!isStatic) throw redirect(to);
  return { lang, redirectTo: to };
}

/** `loader` of a page. */
export function pageLoader(id: string, key: string) {
  return async (args: LoaderArgs): Promise<PageData> => {
    const lang = requireLang(args.params);
    const { feature, page } = findPage(consify, id, key);
    if (page.kind === "redirect")
      return redirectTo(lang, page.redirect({ lang, config: consify.config }));
    try {
      const context = loadContext(feature, lang, args);
      if (!page.entry) {
        return { lang, data: page.load ? await page.load(context) : undefined };
      }
      // a page of an entry: the address names it, core reads it and fills the <head>
      const slug = context.params["*"] ?? Object.values(context.params)[0] ?? "";
      const entry = await context.content.entry(slug);
      if (!entry) return context.notFound();
      const data = page.load ? await page.load({ ...context, entry }) : entry;
      return {
        lang,
        data,
        meta: entryMeta(feature, entry, lang),
        ...(entry.fallback ? { contentLanguage: entry.lang } : {}),
      };
    } catch (error) {
      if (error instanceof RedirectSignal) return redirectTo(lang, error.to);
      throw error;
    }
  };
}

const types: Record<string, string> = {
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  rss: "application/rss+xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** What a file answers with, its type from the extension of its address. */
function toResponse(body: FileBody, key: string): Response {
  if (body instanceof Response) return body;
  const extension = /\.([a-z0-9]+)$/i.exec(key)?.[1]?.toLowerCase() ?? "";
  const type = types[extension];
  if (typeof body === "string") {
    return new Response(body, { headers: { "Content-Type": type ?? "text/plain; charset=utf-8" } });
  }
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
    return new Response(body as BodyInit, {
      headers: { "Content-Type": type ?? "application/octet-stream" },
    });
  }
  return Response.json(body);
}

/** `loader` of a file. */
export function fileLoader(id: string, key: string) {
  return async (args: LoaderArgs): Promise<Response> => {
    const lang = requireLang(args.params);
    const { feature, file } = findFile(consify, id, key);
    try {
      return toResponse(await file.load(loadContext(feature, lang, args)), key);
    } catch (error) {
      if (error instanceof RedirectSignal) throw redirect(error.to);
      throw error;
    }
  };
}

/** `loader` of a file core serves for the content of a feature: its search, `llms.txt`, social images. */
export function contentFileLoader(id: string, kind: ContentFileKind) {
  return async (args: LoaderArgs): Promise<Response> => {
    const lang = requireLang(args.params);
    const feature = consify.feature(id);
    const { content, url } = loadContext(feature, lang, args);
    const { config } = consify;
    if (kind === "rss") {
      const title = [config.site.name, featureText(config, lang, feature.title, feature)].filter(
        Boolean,
      );
      return toResponse(
        await rssText(feature, content, config, lang, title.join(": "), url),
        ".xml",
      );
    }
    if (kind === "search") return searchResponse(feature, content, config, args.request);
    if (kind === "og") {
      const image = await ogImage(
        feature,
        content,
        config,
        lang,
        pageParams(args.params)["*"] ?? "",
      );
      if (!image) throw new Response("Not found", { status: 404 });
      return image;
    }
    return toResponse(await llmsText(feature, content, config, lang, kind === "llms-full"), ".txt");
  };
}
