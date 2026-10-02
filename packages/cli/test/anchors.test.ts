import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { anchorRules, defineConfig, defineFeature } from "@consify/core";
import { addAnchors, anchorDiagnostics, formatRegistry, syncAnchors } from "../src/anchors.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-anchors-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

const write = (file: string, text: string) => {
  const path = join(cwd, "content", file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
const read = (file: string) => readFileSync(join(cwd, "content", file), "utf8");

// a docs feature with a version `v1`, the way `docs({ anchors: true, versions })` makes it
const config = () =>
  defineConfig({
    site: { name: "D" },
    i18n: { defaultLanguage: "ru", languages: ["ru", "en"] },
    features: [
      defineFeature({
        id: "docs",
        pages: {},
        content: {
          anchors: {
            ...(anchorRules(true) as NonNullable<ReturnType<typeof anchorRules>>),
            scope: (path: string) => (path.startsWith("v1/") ? "v1" : ""),
          },
        },
      }),
    ],
  });

function project() {
  write(
    "ru/docs/v1/a.mdx",
    "---\ntitle: A\n---\n\n## Быстрый путь\n\nСм. [далее](./b.mdx#что-дальше) и [тут](#быстрый-путь).\n\n## Установка [#install]\n",
  );
  write("ru/docs/v1/b.mdx", "---\ntitle: B\n---\n\n## Что дальше\n\n## `client.close`\n");
  write(
    "en/docs/v1/a.mdx",
    "---\ntitle: A\n---\n\n## Quick path\n\nSee [next](./b.mdx#next-steps) and [here](#quick-path).\n\n## Install\n",
  );
  write("en/docs/v1/b.mdx", "---\ntitle: B\n---\n\n## Next steps\n\n## `client.close`\n");
}

describe("consify anchors", () => {
  test("a project with no ids: errors, and no registry", () => {
    project();
    const found = anchorDiagnostics(cwd, config());
    expect(found.some((d) => d.message.includes("no registry"))).toBe(true);
    expect(found.some((d) => d.message.includes("no id of its own"))).toBe(true);
  });

  test("add makes the ids of the original and the translation, and fixes the links", () => {
    project();
    addAnchors(cwd, config(), {});
    expect(read("ru/docs/v1/a.mdx")).toContain("## Быстрый путь [#bystryy-put]");
    expect(read("ru/docs/v1/b.mdx")).toContain("## Что дальше [#chto-dalshe]");
    // the translation takes the id of the heading at the same place of the original
    expect(read("en/docs/v1/a.mdx")).toContain("## Quick path [#bystryy-put]");
    // `Install` makes the id `install` itself, the id of the original: nothing to write
    expect(read("en/docs/v1/a.mdx")).toContain("## Install\n");
    expect(read("en/docs/v1/b.mdx")).toContain("## Next steps [#chto-dalshe]");
    // links go to the new ids, in both languages
    expect(read("ru/docs/v1/a.mdx")).toContain("(./b.mdx#chto-dalshe)");
    expect(read("ru/docs/v1/a.mdx")).toContain("(#bystryy-put)");
    expect(read("en/docs/v1/a.mdx")).toContain("(./b.mdx#chto-dalshe)");
    expect(read("en/docs/v1/a.mdx")).toContain("(#bystryy-put)");
    // a heading with an English id of its own is left as it is
    expect(read("ru/docs/v1/b.mdx")).toContain("## `client.close`\n");
  });

  test("sync writes the registry, and then everything agrees", () => {
    project();
    addAnchors(cwd, config(), {});
    syncAnchors(cwd, config(), {});
    expect(JSON.parse(read("ru/docs/v1/anchors.json"))).toEqual({
      "a.mdx": ["bystryy-put", "install"],
      "b.mdx": ["chto-dalshe", "clientclose"],
    });
    expect(anchorDiagnostics(cwd, config())).toEqual([]);
  });

  test("an id that is not in the registry stops the build, an id that is on no page is kept", () => {
    project();
    addAnchors(cwd, config(), {});
    syncAnchors(cwd, config(), {});
    write(
      "ru/docs/v1/b.mdx",
      "---\ntitle: B\n---\n\n## Что дальше [#chto-dalshe]\n\n## Новое [#fresh]\n",
    );
    const found = anchorDiagnostics(cwd, config());
    expect(
      found.some(
        (d) => d.level === "error" && d.message.includes('"fresh" is not in anchors.json'),
      ),
    ).toBe(true);
    expect(found.some((d) => d.level === "warn" && d.message.includes('"clientclose"'))).toBe(true);
    syncAnchors(cwd, config(), {});
    expect(JSON.parse(read("ru/docs/v1/anchors.json"))["b.mdx"]).toEqual([
      "chto-dalshe",
      "fresh",
      "clientclose",
    ]);
    syncAnchors(cwd, config(), { prune: true });
    expect(JSON.parse(read("ru/docs/v1/anchors.json"))["b.mdx"]).toEqual(["chto-dalshe", "fresh"]);
  });

  test("a dry run changes nothing", () => {
    project();
    const before = read("ru/docs/v1/a.mdx");
    addAnchors(cwd, config(), { dry: true });
    syncAnchors(cwd, config(), { dry: true });
    expect(read("ru/docs/v1/a.mdx")).toBe(before);
    expect(existsSync(join(cwd, "content/ru/docs/v1/anchors.json"))).toBe(false);
  });

  test("a translation with another number of headings is left for a person", () => {
    project();
    write(
      "en/docs/v1/b.mdx",
      "---\ntitle: B\n---\n\n## Next steps\n\n## Extra\n\n## `client.close`\n",
    );
    addAnchors(cwd, config(), {});
    expect(read("en/docs/v1/b.mdx")).toContain("## Next steps\n");
    expect(read("en/docs/v1/b.mdx")).not.toContain("[#");
  });
});

describe("the file of the registry", () => {
  test("the ids of a page are on one line when they fit, one to a line when not", () => {
    const registry = {
      "a.mdx": ["one", "two"],
      "b.mdx": ["a-long-id", "another-long-id", "third-long-id"],
    };
    expect(formatRegistry(registry, 100)).toBe(
      '{\n  "a.mdx": ["one", "two"],\n  "b.mdx": ["a-long-id", "another-long-id", "third-long-id"]\n}\n',
    );
    expect(formatRegistry(registry, 40)).toBe(
      '{\n  "a.mdx": ["one", "two"],\n  "b.mdx": [\n    "a-long-id",\n    "another-long-id",\n    "third-long-id"\n  ]\n}\n',
    );
    expect(formatRegistry({}, 80)).toBe("{}\n");
  });
});
