import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { collectSlugs, prerenderPaths } from "../src/build/router/prerender.ts";
import { appDirectory, generatedDir, scaffold } from "../src/build/router/scaffold.ts";
import { defineConfig } from "../src/config/index.ts";
import { componentsFromGlob } from "../src/shared/instance.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "docsivi-rr-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function content(...files: string[]) {
  for (const file of files) {
    const path = join(cwd, "content/docs", file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "---\ntitle: T\n---\n");
  }
}

describe("collectSlugs", () => {
  test("removes the language suffix and index, merges translations", () => {
    const slugs = collectSlugs(
      ["index.mdx", "index.ru.mdx", "guide/setup.mdx", "guide/setup.ru.mdx", "guide/index.mdx"],
      ["en", "ru"],
    );
    expect(slugs).toEqual([[], ["guide", "setup"], ["guide"]]);
  });

  test("a translation without an original still counts, other files are ignored", () => {
    expect(collectSlugs(["only.ru.mdx", "meta.json", "note.txt"], ["en", "ru"])).toEqual([
      ["only"],
    ]);
  });

  test("a dot in the name that is not a language stays in the slug", () => {
    expect(collectSlugs(["v1.2.mdx"], ["en", "ru"])).toEqual([["v1.2"]]);
  });
});

describe("prerenderPaths", () => {
  const base = { site: { name: "D" }, i18n: { languages: ["en", "ru"] } };

  test("every page in every language, even when only one language has the file", () => {
    content("index.mdx", "about.mdx", "about.ru.mdx");
    const paths = prerenderPaths(defineConfig(base), cwd);
    for (const p of ["/en/docs", "/ru/docs/about", "/en/docs/about", "/ru/docs", "/en", "/ru"]) {
      expect(paths).toContain(p);
    }
    expect(paths).toContain("/en/og/about/image.png");
    expect(paths).toContain("/ru/llms.txt");
    expect(paths).toContain("/sitemap.xml");
  });

  test("server mode does not pre-render / or the search index, static mode does", () => {
    content("index.mdx");
    expect(prerenderPaths(defineConfig(base), cwd)).not.toContain("/api/search");
    const staticPaths = prerenderPaths(defineConfig({ ...base, deploy: { mode: "static" } }), cwd);
    expect(staticPaths).toContain("/");
    expect(staticPaths).toContain("/api/search");
  });

  test("OG images are skipped when the feature is off, no duplicates", () => {
    content("index.mdx", "index.ru.mdx");
    const paths = prerenderPaths(defineConfig({ ...base, features: { og: false } }), cwd);
    expect(paths.some((p) => p.includes("/og/"))).toBe(false);
    expect(new Set(paths).size).toBe(paths.length);
  });

  test("in server mode the versioned /docs redirect is not pre-rendered, in static mode it is", () => {
    content("v2/index.mdx");
    const versions = { list: [{ id: "v2", status: "latest" as const }] };
    const server = prerenderPaths(defineConfig({ ...base, versions }), cwd);
    expect(server).not.toContain("/en/docs");
    expect(server).toContain("/en/docs/v2");
    const staticPaths = prerenderPaths(
      defineConfig({ ...base, versions, deploy: { mode: "static" } }),
      cwd,
    );
    expect(staticPaths).toContain("/en/docs");
  });

  test("a missing content folder gives only the fixed pages", () => {
    expect(prerenderPaths(defineConfig(base), cwd)).toContain("/en");
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
    expect(result.Hello).toBe(Hello);
  });
});

describe("scaffold", () => {
  test("writes the instance, root and routes; adds custom/theme.css only when it exists", () => {
    scaffold(cwd);
    const root = () => readFileSync(join(cwd, appDirectory, "root.tsx"), "utf8");
    expect(existsSync(join(cwd, generatedDir, "instance.ts"))).toBe(true);
    expect(readFileSync(join(cwd, appDirectory, "routes.ts"), "utf8")).toContain(
      "docsivi/react-router/routes",
    );
    expect(root()).toContain('import "docsivi/theme.css"');
    expect(root()).not.toContain("custom/theme.css");

    mkdirSync(join(cwd, "custom"), { recursive: true });
    writeFileSync(join(cwd, "custom/theme.css"), "");
    scaffold(cwd);
    expect(root()).toContain('import "../../custom/theme.css"');
  });

  test("the instance calls the content macro and imports the project config", () => {
    scaffold(cwd);
    const instance = readFileSync(join(cwd, generatedDir, "instance.ts"), "utf8");
    expect(instance).toContain("defineDocs");
    expect(instance).toContain("async: true");
    expect(instance).toContain('import config from "../docs.config.ts"');
    expect(instance).toContain("import.meta.glob");
  });
});
