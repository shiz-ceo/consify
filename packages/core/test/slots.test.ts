import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { homeFileName } from "../src/features/home/mdx-home.ts";
import { slotsFromGlob } from "../src/shared/slots.ts";

describe("slotsFromGlob", () => {
  const Home = () => null;
  const Header = () => null;
  const End = () => null;
  const Footer = () => null;

  test("maps the files of custom/ to the slots", () => {
    const slots = slotsFromGlob({
      "/custom/home.tsx": { default: Home },
      "/custom/header.tsx": { default: Header, End },
      "/custom/footer.jsx": { default: Footer },
    });
    expect(slots).toEqual({ Home, Header, HeaderEnd: End, Footer });
  });

  test("ignores other files and modules without a default export", () => {
    expect(
      slotsFromGlob({
        "/custom/other.tsx": { default: Home },
        "/custom/home.tsx": {},
        "/custom/components/Footer.tsx": { default: Footer },
      }),
    ).toEqual({});
  });
});

describe("slots in the config", () => {
  test("accepts components and rejects anything else", () => {
    const Footer = () => null;
    expect(defineConfig({ site: { name: "D" }, slots: { footer: Footer } }).slots?.footer).toBe(
      Footer,
    );
    expect(() =>
      defineConfig({ site: { name: "D" }, slots: { footer: "nope" } } as never),
    ).toThrow();
    expect(() =>
      defineConfig({ site: { name: "D" }, slots: { sidebar: Footer } } as never),
    ).toThrow();
  });
});

describe("homeFileName", () => {
  test("the default language also reads the file without a suffix", () => {
    expect(homeFileName("en", "en")).toEqual(["home.en.mdx", "home.mdx"]);
    expect(homeFileName("ru", "en")).toEqual(["home.ru.mdx"]);
  });
});

describe("routes of features that are off", () => {
  test("are left out of the list handed to the router", async () => {
    const { enabledRouteKeys } = await import("../src/build/router/route-list.ts");
    const off = enabledRouteKeys(defineConfig({ site: { name: "D" }, features: { og: false } }));
    expect(off).toContain("docs:routes/docs");
    expect(off).not.toContain("docs:routes/og");
    expect(off.some((key) => key.startsWith("blog:"))).toBe(false);
    expect(off.some((key) => key.startsWith("api-reference:"))).toBe(false);

    const on = enabledRouteKeys(
      defineConfig({ site: { name: "D" }, blog: { rss: false }, openapi: { input: "x.json" } }),
    );
    expect(on).toContain("blog:routes/blog");
    expect(on).not.toContain("blog:routes/blog-feed");
    expect(on).toContain("api-reference:routes/api-reference");
  });
});

describe("header.hideSearchOn", () => {
  test("takes section ids and rejects anything else", () => {
    expect(defineConfig({ site: { name: "D" } }).header).toBeUndefined();
    expect(
      defineConfig({ site: { name: "D" }, header: { hideSearchOn: ["blog"] } }).header,
    ).toEqual({ hideSearchOn: ["blog"] });
    expect(() =>
      defineConfig({ site: { name: "D" }, header: { hideSearchOn: ["shop"] } } as never),
    ).toThrow();
  });
});

describe("routes that need posts", () => {
  test("a blog with no published post has no post pages, and has them once there is one", async () => {
    const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { enabledRouteKeys } = await import("../src/build/router/route-list.ts");
    const cwd = mkdtempSync(join(tmpdir(), "consify-routes-"));
    try {
      const config = defineConfig({ site: { name: "D" }, blog: {} });
      const without = enabledRouteKeys(config, cwd);
      expect(without).toContain("blog:routes/blog");
      expect(without).not.toContain("blog:routes/blog-post");
      expect(without).not.toContain("blog:routes/blog-og");

      mkdirSync(join(cwd, "content/blog"), { recursive: true });
      writeFileSync(
        join(cwd, "content/blog/a.mdx"),
        "---\ntitle: A\ndescription: a\ndate: 2020-01-01\n---\n\nText\n",
      );
      const withPost = enabledRouteKeys(config, cwd);
      expect(withPost).toContain("blog:routes/blog-post");
      expect(withPost).toContain("blog:routes/blog-og");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
