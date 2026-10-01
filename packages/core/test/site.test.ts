import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { prerenderPaths } from "../src/build/router/prerender.ts";
import { routes } from "../src/build/router/routes.ts";
import { appDirectory, generatedDir, scaffold } from "../src/build/router/scaffold.ts";
import { defineConfig } from "../src/config/index.ts";
import { defineFeature, page } from "../src/feature/define.ts";
import { componentsFromGlob } from "../src/shared/instance.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-site-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function write(path: string, text: string) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), text);
}

const View = () => null;
const section = defineFeature({ id: "section", title: "Section", pages: { "/": View } });
const base = { site: { name: "D" }, i18n: { languages: ["en", "ru"] }, features: [section] };

describe("the front page", () => {
  test("without home.mdx it sends to the first section: left out on a server, built when static", async () => {
    expect(await prerenderPaths(defineConfig(base), cwd)).not.toContain("/en");
    const built = await prerenderPaths(defineConfig({ ...base, deploy: { mode: "static" } }), cwd);
    expect(built).toEqual(expect.arrayContaining(["/", "/en", "/ru"]));
  });

  test("content/<language>/home.mdx makes it a page", async () => {
    write("content/en/home.mdx", "# Hi");
    expect(await prerenderPaths(defineConfig(base), cwd)).toEqual(
      expect.arrayContaining(["/en", "/ru", "/en/section", "/sitemap.xml", "/robots.txt"]),
    );
  });

  test("a feature at the front page replaces the built-in one", async () => {
    const own = defineFeature({ id: "landing", path: "", pages: { "/": View } });
    const list = await routes(defineConfig({ site: { name: "D" }, features: [own] }), cwd);
    const modules = list.map((r) => readFileSync(r.file, "utf8"));
    expect(modules.some((m) => m.includes('"home"'))).toBe(false);
    expect(modules.some((m) => m.includes('"landing"'))).toBe(true);
  });
});

describe("routes", () => {
  test("a small module per page and file, and the parts of core", async () => {
    const shop = defineFeature({
      id: "shop",
      pages: { "/": View, "/:item": page({ paths: () => [{ item: "a" }], component: View }) },
      files: { "/feed.json": () => ({}) },
    });
    const list = await routes(defineConfig({ site: { name: "D" }, features: [shop] }), cwd);
    const paths = list.map((r) => r.path ?? "(index)");
    expect(paths).toEqual(
      expect.arrayContaining([
        ":lang/shop",
        ":lang/shop/:item",
        ":lang/shop/feed.json",
        "sitemap.xml",
        "*",
      ]),
    );
    const item = list.find((r) => r.path === ":lang/shop/:item");
    expect(readFileSync(item?.file as string, "utf8")).toContain('pageLoader("shop", "/:item")');
  });

  test("a static site leaves out a page with nothing to build", async () => {
    const shop = defineFeature({
      id: "shop",
      pages: { "/:item": page({ paths: () => [], component: View }) },
    });
    const config = defineConfig({
      site: { name: "D" },
      deploy: { mode: "static" },
      features: [shop],
    });
    expect((await routes(config, cwd)).map((r) => r.path)).not.toContain(":lang/shop/:item");
  });
});

describe("scaffold", () => {
  test("writes the instance, the styles, root and routes; custom/theme.css only when it exists", () => {
    scaffold(cwd);
    const root = () => readFileSync(join(cwd, appDirectory, "root.tsx"), "utf8");
    expect(readFileSync(join(cwd, generatedDir, "instance.ts"), "utf8")).toContain(
      'import config from "../docs.config.ts"',
    );
    expect(existsSync(join(cwd, generatedDir, "styles.css"))).toBe(true);
    expect(readFileSync(join(cwd, appDirectory, "routes.ts"), "utf8")).toContain(
      "@consify/core/react-router/routes",
    );
    expect(root()).not.toContain("custom/theme.css");
    write("custom/theme.css", "");
    scaffold(cwd);
    expect(root()).toContain('import "../../custom/theme.css"');
  });
});

describe("componentsFromGlob", () => {
  test("uses the file name as the tag and the default export as the component", () => {
    const Hello = () => null;
    const result = componentsFromGlob({
      "/custom/components/Hello.tsx": { default: Hello },
      "/custom/components/Since.jsx": { default: Hello },
      "/custom/components/helper.tsx": { default: Hello },
      "/custom/components/NoDefault.tsx": {},
    });
    expect(Object.keys(result).sort()).toEqual(["Hello", "Since"]);
  });
});
