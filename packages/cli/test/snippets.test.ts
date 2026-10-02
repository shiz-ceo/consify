import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defineConfig, defineFeature } from "@consify/core";
import { codeBlocksOf, findRepeated, snippetDiagnostics } from "../src/snippets.ts";

let cwd: string;
beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "consify-snippets-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

const write = (file: string, text: string) => {
  const path = join(cwd, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

// a docs feature with a version `v1`, the way `docs({ snippets: true, versions })` makes it
const config = (on = true) =>
  defineConfig({
    site: { name: "D" },
    i18n: { defaultLanguage: "en", languages: ["en", "ru"] },
    features: [
      defineFeature({
        id: "docs",
        pages: {},
        content: on
          ? {
              snippets: {
                dir: "snippets",
                version: (path: string) => (path.startsWith("v1/") ? "v1" : ""),
                versions: ["v1"],
              },
            }
          : {},
      }),
    ],
  });

const said = async () =>
  (await snippetDiagnostics(cwd, config())).map((d) => `${d.level} ${d.where}: ${d.message}`);

describe("consify snippets check", () => {
  test("a site whose snippets agree has nothing to say", async () => {
    write("content/en/docs/v1/a.mdx", '---\ntitle: A\n---\n\n<Snippet id="db#open" />\n');
    write("content/ru/docs/v1/a.mdx", '---\ntitle: A\n---\n\n<Snippet id="db#open" />\n');
    write("snippets/v1/db.ts", "// #region open\nconst db = open(); // open it\n// #endregion\n");
    write(
      "snippets/v1/ru/db.ts",
      "// #region open\nconst db = open(); // открыть\n// #endregion\n",
    );
    expect(await said()).toEqual([]);
  });

  test("a missing snippet, a loop, a heading, a missing region are errors", async () => {
    write(
      "content/en/docs/v1/a.mdx",
      '---\ntitle: A\n---\n\n<Snippet id="gone" />\n\n<Snippet id="loop" />\n\n<Snippet id="titled" />\n\n<Snippet id="db#nope" />\n',
    );
    write("snippets/v1/loop.mdx", '<Snippet id="loop" />\n');
    write("snippets/v1/titled.mdx", "## A heading\n");
    write("snippets/v1/db.ts", "x\n");
    write("snippets/v2/old.ts", "x\n");
    write("snippets/v1/unused.ts", "x\n");
    const found = await said();
    expect(found).toContainEqual(
      'error content/en/docs/v1/a.mdx:5: snippet "gone" not found: tried snippets/v1/en/gone.*, snippets/v1/gone.*',
    );
    expect(found).toContainEqual(
      "error snippets/v1/loop.mdx:1: snippets include each other: snippets/v1/loop.mdx → snippets/v1/loop.mdx",
    );
    expect(found).toContainEqual(
      expect.stringContaining("error snippets/v1/titled.mdx:1: a heading"),
    );
    expect(found).toContainEqual(
      expect.stringContaining(
        'error content/en/docs/v1/a.mdx:11: snippets/v1/db.ts: there is no region "nope"',
      ),
    );
    expect(found).toContainEqual(
      expect.stringContaining('error snippets/v2/old.ts: "v2" is not a version'),
    );
    expect(found).toContainEqual("warn snippets/v1/unused.ts: no page uses this snippet");
  });

  test("a page with no version reads WITHOUT_VERSION; features without snippets are not checked", async () => {
    write("content/en/docs/intro.mdx", '---\ntitle: I\n---\n\n<Snippet id="hello" />\n');
    write("snippets/WITHOUT_VERSION/hello.sh", "echo hi\n");
    expect(await said()).toEqual([]);
    expect(await snippetDiagnostics(cwd, config(false))).toEqual([]);
  });
});

describe("consify snippets find", () => {
  test("the code blocks of a page, indented ones too", () => {
    const blocks = codeBlocksOf(
      'Text\n\n```ts title="a.ts" {2}\nconst a = 1;\n```\n\n- Item\n\n  ```sh\n  ls\n  ```\n',
    );
    expect(blocks).toEqual([
      { lang: "ts", meta: 'title="a.ts" {2}', code: "const a = 1;", line: 3 },
      { lang: "sh", meta: "", code: "ls", line: 9 },
    ]);
  });

  test("a block on two pages, or in two languages, is listed with a snippet for it", () => {
    const block = '```ts title="db.ts" twoslash\nconst db = open();\ndb.ping();\ndb.close();\n```';
    write("content/en/docs/v1/a.mdx", `---\ntitle: A\n---\n\n${block}\n`);
    write("content/ru/docs/v1/a.mdx", `---\ntitle: A\n---\n\n${block}\n`);
    write(
      "content/en/docs/v1/b.mdx",
      `---\ntitle: B\n---\n\n${block}\n\n\`\`\`sh\nshort\n\`\`\`\n`,
    );
    write("content/en/docs/v1/c.mdx", "---\ntitle: C\n---\n\n```sh\nshort\n```\n");
    const found = findRepeated(cwd, config(), 3);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      file: "snippets/v1/db.ts",
      tag: '<Snippet id="db" title="db.ts" twoslash />',
      places: [
        "content/en/docs/v1/a.mdx:5",
        "content/en/docs/v1/b.mdx:5",
        "content/ru/docs/v1/a.mdx:5",
      ],
    });
    // with a lower bound the one-line block is there too
    expect(findRepeated(cwd, config(), 1).map((r) => r.file)).toEqual([
      "snippets/v1/db.ts",
      "snippets/v1/b-2.sh",
    ]);
  });
});
