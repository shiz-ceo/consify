import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { defineConfig } from "../src/config/index.ts";
import { resolveHead } from "../src/shared/head.ts";
import { SiteHead } from "../src/shared/layout/site-head.tsx";

const site = { name: "D" };

describe("head", () => {
  test("is empty by default", () => {
    expect(resolveHead(defineConfig({ site }), "en")).toEqual({ meta: [], links: [], scripts: [] });
  });

  test("meta, links and scripts become tags", () => {
    const config = defineConfig({
      site,
      head: {
        meta: [
          { name: "theme-color", content: "#0ea5e9" },
          { property: "og:locale", content: "en" },
        ],
        links: [
          { rel: "preconnect", href: "https://fonts.googleapis.com", crossOrigin: "anonymous" },
        ],
        scripts: [
          {
            src: "https://plausible.io/js/script.js",
            defer: true,
            data: { domain: "lattice.dev" },
          },
          { inline: "window.dataLayer = [];" },
        ],
      },
    });
    const html = renderToStaticMarkup(<SiteHead head={resolveHead(config, "en")} />);
    expect(html).toContain('<meta name="theme-color" content="#0ea5e9"/>');
    expect(html).toContain('<meta property="og:locale" content="en"/>');
    expect(html).toContain('rel="preconnect"');
    expect(html).toContain('crossorigin="anonymous"');
    expect(html).toContain('src="https://plausible.io/js/script.js"');
    expect(html).toContain('data-domain="lattice.dev"');
    expect(html).toContain("<script>window.dataLayer = [];</script>");
  });

  test("a function of the language gives tags per language, and its result is checked", () => {
    const config = defineConfig({
      site,
      head: (lang) => ({ meta: [{ property: "og:locale", content: lang }] }),
    });
    expect(resolveHead(config, "ru").meta).toEqual([{ property: "og:locale", content: "ru" }]);
    const bad = defineConfig({ site, head: () => ({ meta: [{ content: "x" }] }) });
    expect(() => resolveHead(bad, "en")).toThrow();
  });

  test("a meta tag needs a name, a property or an http-equiv, and unknown fields are rejected", () => {
    expect(() => defineConfig({ site, head: { meta: [{ content: "x" }] } })).toThrow(
      /needs `name`/,
    );
    expect(() =>
      defineConfig({ site, head: { scripts: [{ src: "a.js", nope: 1 }] } } as never),
    ).toThrow();
    expect(() => defineConfig({ site, head: { scripts: [{ inline: "" }] } })).toThrow();
  });
});

describe("banner", () => {
  test("has a variant with a default, and an id that is safe as an element id", () => {
    expect(defineConfig({ site }).banner).toBeUndefined();
    const banner = defineConfig({ site, banner: { text: "Hi" } }).banner;
    expect(banner).toEqual({ text: "Hi", variant: "info" });
    expect(() => defineConfig({ site, banner: { text: "Hi", id: "a b" } })).toThrow();
    expect(() =>
      defineConfig({ site, banner: { text: "Hi", variant: "loud" } } as never),
    ).toThrow();
    expect(
      defineConfig({ site, banner: { text: { en: "Hi", ru: "Привет" }, href: "/docs", id: "v2" } })
        .banner?.id,
    ).toBe("v2");
  });
});
