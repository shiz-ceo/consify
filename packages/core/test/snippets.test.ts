import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { defineConfig } from "../src/config/index.ts";
import { bundledSource, createContent } from "../src/content/files.ts";
import { checkSnippets, mdxParser, withoutComments } from "../src/content/snippets.ts";
import { defineFeature } from "../src/feature/define.ts";
import {
  codeMeta,
  expandSnippets,
  expandSnippetsText,
  idProblem,
  regionOf,
  resolveSnippet,
  type SnippetFiles,
  type SnippetNode,
} from "../src/mdx/snippets.ts";

const memory = (files: Record<string, string>): SnippetFiles => ({
  list: () => Object.keys(files).sort(),
  read: async (path) => {
    const text = files[path];
    if (text === undefined) throw new Error(`no ${path}`);
    return text;
  },
});

const place = { lang: "ru", version: "v1", defaultLanguage: "en", languages: ["en", "ru"] };
const config = defineConfig({
  site: { name: "T" },
  i18n: { defaultLanguage: "en", languages: ["en", "ru"] },
  mdx: { twoslash: false },
});
const parse = mdxParser(config);

/** The page after its snippets are put in place: its top nodes, and the problems. */
async function expand(page: string, files: Record<string, string>, at = place) {
  const tree = parse(page);
  const found = await expandSnippets(tree, {
    files: memory(files),
    dir: "snippets",
    page: "page.mdx",
    place: at,
    parse,
  });
  return {
    tree,
    ...found,
    messages: found.problems.map((p) => `${p.file}:${p.line} ${p.message}`),
  };
}

describe("resolveSnippet", () => {
  const files = [
    "v1/db/connect.ts",
    "v1/ru/prereqs.mdx",
    "v1/prereqs.mdx",
    "v1/en/only-en.mdx",
    "v2/db/connect.ts",
    "WITHOUT_VERSION/hello.ts",
  ];

  test("the variant of the language, then the common file, then the default language", () => {
    expect(resolveSnippet(files, "prereqs", place).path).toBe("v1/ru/prereqs.mdx");
    expect(resolveSnippet(files, "prereqs", { ...place, lang: "en" }).path).toBe("v1/prereqs.mdx");
    expect(resolveSnippet(files, "db/connect", place).path).toBe("v1/db/connect.ts");
    expect(resolveSnippet(files, "only-en", place).path).toBe("v1/en/only-en.mdx");
  });

  test("a page with no version reads WITHOUT_VERSION, `version` reads another folder", () => {
    expect(resolveSnippet(files, "hello", { ...place, version: "" }).path).toBe(
      "WITHOUT_VERSION/hello.ts",
    );
    expect(resolveSnippet(files, "db/connect", place, "v2").path).toBe("v2/db/connect.ts");
    expect(resolveSnippet(files, "hello", place, "WITHOUT_VERSION").path).toBe(
      "WITHOUT_VERSION/hello.ts",
    );
  });

  test("not found: the paths that were tried, in order", () => {
    const found = resolveSnippet(files, "nope", place);
    expect(found.path).toBeUndefined();
    expect(found.tried).toEqual(["v1/ru/nope.*", "v1/nope.*", "v1/en/nope.*"]);
  });

  test("two files with one id, and an id that starts with a language", () => {
    expect(resolveSnippet(["v1/a.ts", "v1/a.js"], "a", place).error).toContain("several");
    // `connect.test.ts` is the id `connect.test`, not `connect`
    expect(resolveSnippet(["v1/connect.test.ts"], "connect", place).path).toBeUndefined();
    expect(idProblem("ru/prereqs", ["en", "ru"])).toContain("language");
    expect(idProblem("../x", ["en"])).toContain("not a path");
    expect(idProblem("db/connect", ["en", "ru"])).toBeUndefined();
  });
});

describe("regions", () => {
  const file = [
    "import { db } from './db';",
    "",
    "// #region open",
    "  const client = db.open();",
    "  // #region inner",
    "  client.ping();",
    "  // #endregion inner",
    "// #endregion open",
    "# #region shell",
    "ls",
    "# #endregion",
    "<!-- #region html -->",
    "<p>Hi</p>",
    "<!-- #endregion -->",
  ].join("\n");

  test("the lines of a region, without the markers and the common indent", () => {
    expect(regionOf(file, "open")).toEqual({ code: "const client = db.open();\nclient.ping();" });
    expect(regionOf(file, "inner")).toEqual({ code: "client.ping();" });
    expect(regionOf(file, "shell")).toEqual({ code: "ls" });
    expect(regionOf(file, "html")).toEqual({ code: "<p>Hi</p>" });
  });

  test("the whole file has no markers; a region that is not there is an error", () => {
    const whole = regionOf(file, undefined) as { code: string };
    expect(whole.code).not.toContain("#region");
    expect(whole.code).toContain("client.ping();");
    expect(regionOf(file, "nope")).toEqual({ error: expect.stringContaining('no region "nope"') });
    expect(regionOf("// #region a\nx", "a")).toEqual({
      error: expect.stringContaining("#endregion"),
    });
  });
});

describe("code snippets", () => {
  test("the props are the meta of a fenced block", () => {
    expect(
      codeMeta({ title: "db.ts", highlight: "2, 4-5", lineNumbers: true, twoslash: true }),
    ).toBe('title="db.ts" {2,4-5} lineNumbers twoslash');
    expect(codeMeta({ lineNumbers: 10, noCopy: true, meta: 'tab="npm"' })).toBe(
      'lineNumbers=10 noCopy tab="npm"',
    );
    expect(codeMeta({ title: 'say "hi"' })).toBe("title='say \"hi\"'");
  });

  test("a code file is a code block with its language and meta, in place of the tag", async () => {
    const { tree, messages, used } = await expand(
      'Text\n\n<Snippet id="db/connect#open" title="db.ts" highlight="1" twoslash />\n\nMore',
      {
        "v1/db/connect.ts": "x();\n// #region open\nopen(); // [!code highlight]\n// #endregion\n",
      },
    );
    expect(messages).toEqual([]);
    expect([...used]).toEqual(["v1/db/connect.ts"]);
    const code = tree.children?.[1] as SnippetNode;
    expect(code).toMatchObject({
      type: "code",
      lang: "ts",
      meta: 'title="db.ts" {1} twoslash',
      value: "open(); // [!code highlight]",
    });
  });

  test("lang reads any file as code, an mjs file is js", async () => {
    const { tree } = await expand('<Snippet id="a" lang="md" />\n\n<Snippet id="b" />', {
      "v1/a.mdx": "# Title",
      "v1/b.mjs": "export {}",
    });
    expect(tree.children?.map((n) => [n.type, n.lang])).toEqual([
      ["code", "md"],
      ["code", "js"],
    ]);
  });

  test("wrong props, a missing snippet and a missing region are errors", async () => {
    const { messages } = await expand(
      [
        '<Snippet id="db" colour="red" />',
        '<Snippet id="nope" />',
        '<Snippet id="db#nope" />',
        '<Snippet id="db" twoslash="yes" />',
        "<Snippet />",
        'Inline <Snippet id="db" /> text',
      ].join("\n\n"),
      { "v1/db.ts": "x" },
    );
    expect(messages).toEqual([
      expect.stringContaining('page.mdx:1 `<Snippet>` has no prop "colour"'),
      expect.stringContaining(
        'page.mdx:3 snippet "nope" not found: tried snippets/v1/ru/nope.*, snippets/v1/nope.*, snippets/v1/en/nope.*',
      ),
      expect.stringContaining('page.mdx:5 snippets/v1/db.ts: there is no region "nope"'),
      expect.stringContaining('page.mdx:7 "twoslash" of `<Snippet>` is true or false'),
      expect.stringContaining("page.mdx:9 `<Snippet>` needs an id"),
      expect.stringContaining("page.mdx:11 `<Snippet>` is a block"),
    ]);
  });
});

describe("text snippets", () => {
  test("an .mdx file is spliced in: its nodes, nested snippets, the language variant", async () => {
    const { tree, messages, used } = await expand('## Setup\n\n<Snippet id="prereqs" />\n\nAfter', {
      "v1/prereqs.mdx": "Common",
      "v1/ru/prereqs.mdx":
        'Нужно:\n\n<Callout>\n  Node 22\n</Callout>\n\n<Snippet id="install" title="Shell" />',
      "v1/install.sh": "npm i consify",
    });
    expect(messages).toEqual([]);
    expect(tree.children?.map((n) => n.type)).toEqual([
      "heading",
      "paragraph",
      "mdxJsxFlowElement",
      "code",
      "paragraph",
    ]);
    expect(tree.children?.[3]).toMatchObject({ lang: "sh", meta: 'title="Shell"' });
    expect([...used].sort()).toEqual(["v1/install.sh", "v1/ru/prereqs.mdx"]);
  });

  test("snippets that include each other are an error", async () => {
    const { messages } = await expand('<Snippet id="a" />', {
      "v1/a.mdx": '<Snippet id="b" />',
      "v1/b.mdx": 'Text\n\n<Snippet id="a" />',
    });
    expect(messages).toEqual([
      "snippets/v1/b.mdx:3 snippets include each other: snippets/v1/a.mdx → snippets/v1/b.mdx → snippets/v1/a.mdx",
    ]);
  });

  test("a heading, front matter and code props in a text snippet are errors", async () => {
    const { messages } = await expand(
      '<Snippet id="a" />\n\n<Snippet id="b" />\n\n<Snippet id="c" title="x" />',
      { "v1/a.mdx": "Text\n\n## A heading", "v1/b.mdx": "---\nx: 1\n---\nText", "v1/c.mdx": "C" },
    );
    expect(messages).toEqual([
      expect.stringContaining("snippets/v1/a.mdx:3 a heading in a snippet"),
      expect.stringContaining("page.mdx:3 snippets/v1/b.mdx: a snippet has no front matter"),
      expect.stringContaining("page.mdx:5 title: only for a code snippet"),
    ]);
  });

  test("imports go to the top of the page once; a name of the page for another thing is an error", async () => {
    const { tree, messages } = await expand(
      'import { Chart } from "./chart";\n\n<Snippet id="a" />\n\n<Snippet id="b" />',
      {
        "v1/a.mdx": 'import { Chart } from "./chart";\nimport { Pie } from "./pie";\n\n<Pie />',
        "v1/b.mdx": 'import { Pie } from "./other";\n\n<Pie />',
      },
    );
    expect(messages).toEqual([
      expect.stringContaining(
        'snippets/v1/b.mdx:1 the import "Pie" (./other Pie) conflicts with "Pie" of the page (./pie Pie)',
      ),
    ]);
    const esm = tree.children?.filter((n) => n.type === "mdxjsEsm") ?? [];
    const names = esm.flatMap((n) =>
      (n.data?.estree?.body ?? []).flatMap((s) =>
        (s.specifiers as { local: { name: string } }[]).map((x) => x.local.name),
      ),
    );
    expect(names.sort()).toEqual(["Chart", "Pie"]);
  });

  test("the text of a page with its snippets, for llms.txt", async () => {
    const text = await expandSnippetsText(
      '## Setup\n\n- Step:\n\n  <Snippet id="run" title="Run" />\n\n<Snippet id="note" />\n',
      {
        files: memory({
          "v1/run.sh": "npm i\nnpm run dev",
          "v1/note.mdx": 'import { X } from "./x";\n\nA note.',
        }),
        dir: "snippets",
        place,
        parse,
      },
    );
    expect(text).toBe(
      '## Setup\n\n- Step:\n\n  ```sh title="Run"\n  npm i\n  npm run dev\n  ```\n\nA note.\n',
    );
  });
});

describe("checkSnippets", () => {
  test("unused files, folders that are not versions, variants that differ in code", async () => {
    const files = memory({
      "v1/db.ts": "// open the database\nconst db = open();",
      "v1/ru/db.ts": "// открыть базу\nconst db = open();",
      "v1/en/db.ts": "// open\nconst db = open(1);",
      "v1/unused.mdx": "Nobody",
      "v9/x.ts": "x",
      "loose.ts": "x",
      "v1/ru.ts": "x",
    });
    const found = await checkSnippets({
      dir: "snippets",
      files,
      defaultLanguage: "en",
      languages: ["en", "ru"],
      versions: ["v1"],
      pages: [
        {
          lang: "ru",
          file: "content/ru/docs/v1/a.mdx",
          version: "v1",
          text: '---\ntitle: A\n---\n\n<Snippet id="db" />\n\n<Snippet id="gone" />',
        },
        {
          lang: "en",
          file: "content/en/docs/v1/a.mdx",
          version: "v1",
          text: '<Snippet id="db" />',
        },
      ],
      parse,
    });
    const said = found.map((d) => `${d.level} ${d.where}: ${d.message}`);
    expect(said).toContainEqual(
      expect.stringContaining('error content/ru/docs/v1/a.mdx:7: snippet "gone" not found'),
    );
    expect(said).toContainEqual(
      expect.stringContaining("warn snippets/v1/unused.mdx: no page uses"),
    );
    expect(said).toContainEqual(
      expect.stringContaining('error snippets/v9/x.ts: "v9" is not a version'),
    );
    expect(said).toContainEqual(
      expect.stringContaining("error snippets/loose.ts: a snippet is in the folder of a version"),
    );
    expect(said).toContainEqual(
      expect.stringContaining(
        "error snippets/v1/ru.ts: the id of a snippet is never the code of a language",
      ),
    );
    // the Russian variant differs in its comment only, the English one in its code
    expect(said).toContainEqual(
      expect.stringContaining("warn snippets/v1/en/db.ts: the code differs from snippets/v1/db.ts"),
    );
    expect(said.some((s) => s.includes("snippets/v1/ru/db.ts: the code differs"))).toBe(false);
    // the common file is used by no page (each language has its own), so it is said
    expect(said).toContainEqual("warn snippets/v1/db.ts: no page uses this snippet");
  });

  test("comments are left out of the comparison", () => {
    expect(withoutComments("a(); // x\n/* y */\nb();", "ts")).toBe("a();\nb();");
    expect(withoutComments("# x\nls -la # list\n", "sh")).toBe("ls -la");
  });
});

describe("snippets compiled with a page", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-snippets-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), text);
  };
  const feature = (on: boolean) =>
    defineFeature({
      id: "docs",
      content: {
        ...(on
          ? {
              snippets: {
                dir: "snippets",
                version: (path: string) => (path.startsWith("v1/") ? "v1" : ""),
                versions: ["v1"],
              },
            }
          : {}),
      },
    });
  const site = (on: boolean) =>
    defineConfig({
      site: { name: "T" },
      i18n: { defaultLanguage: "en", languages: ["en", "ru"] },
      mdx: { twoslash: false },
      features: [feature(on)],
    });

  test("a code snippet is highlighted with its notations; editing it compiles the page again", async () => {
    const config = site(true);
    write(
      "content/en/docs/v1/a.mdx",
      '---\ntitle: A\n---\n\n<Snippet id="hello" title="hello.ts" />\n',
    );
    write("snippets/v1/hello.ts", "const one = 1; // [!code highlight]\nconst two = 2;\n");
    const content = createContent({ config, cwd, feature: feature(true), lang: "en" });
    const first = await content.mdx("v1/a.mdx");
    expect(first?.code).toContain("hello.ts");
    expect(first?.code).toContain("highlighted");
    expect(first?.code).not.toContain("[!code");
    expect(first?.text).toContain('```ts title="hello.ts"');
    expect(await content.markdown("v1/a.mdx")).toContain("const two = 2;");
    // a second compile of the same text is the cached one, until a snippet changes
    expect((await content.mdx("v1/a.mdx"))?.code).toBe(first?.code as string);
    write("snippets/v1/hello.ts", "const three = 3;\n");
    const second = await content.mdx("v1/a.mdx");
    expect(second?.code).toContain("three");
  });

  test("a text snippet with a component and a Russian variant", async () => {
    const config = site(true);
    write("content/ru/docs/v1/a.mdx", '---\ntitle: A\n---\n\n<Snippet id="note" />\n');
    write("snippets/v1/note.mdx", "<Callout>English</Callout>\n");
    write("snippets/v1/ru/note.mdx", "<Callout>Русский</Callout>\n");
    const ru = createContent({ config, cwd, feature: feature(true), lang: "ru" });
    const code = (await ru.mdx("v1/a.mdx"))?.code ?? "";
    expect(code).toContain("Русский");
    expect(code).toContain("Callout");
  });

  test("a missing snippet stops the page; with snippets off, the tag says how to turn them on", async () => {
    write("content/en/docs/v1/a.mdx", '---\ntitle: A\n---\n\n<Snippet id="nope" />\n');
    const on = createContent({ config: site(true), cwd, feature: feature(true), lang: "en" });
    await expect(on.mdx("v1/a.mdx")).rejects.toThrow(/snippet "nope" not found/);
    const off = createContent({ config: site(false), cwd, feature: feature(false), lang: "en" });
    await expect(off.mdx("v1/a.mdx")).rejects.toThrow(/docs\(\{ snippets: true \}\)/);
  });

  test("a built server reads the snippets from its bundle", async () => {
    const source = bundledSource(
      { "/content/en/docs/a.mdx": async () => '---\ntitle: A\n---\n\n<Snippet id="x" />\n' },
      { "/snippets/WITHOUT_VERSION/x.ts": async () => "const fromBundle = 1;" },
    );
    const content = createContent({
      config: site(true),
      cwd,
      feature: feature(true),
      lang: "en",
      source,
    });
    expect((await content.mdx("a.mdx"))?.code).toContain("fromBundle");
  });
});
