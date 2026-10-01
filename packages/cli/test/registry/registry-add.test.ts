import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import * as childProcess from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAddCommand, topologicalSort } from "../../src/registry/add.ts";
import { writeRegistriesFile } from "../../src/registry/config.ts";
import type { FetchedItem } from "../../src/registry/fetch.ts";
import { readLockfile, writeLockfile } from "../../src/registry/lockfile.ts";
import type { RegistryItem } from "../../src/registry/schema.ts";

// A real Bun.serve() instance serving fixture registry-item bodies from an in-memory route table —
// closest to a real integration test, and the only way to convincingly assert that an
// `add-source --header` value actually arrives on the wire (a fetch mock can't verify that as well).
let server: ReturnType<typeof Bun.serve>;
const routes = new Map<string, { body: unknown; status?: number } | (() => Response)>();
let lastRequestHeaders: Headers | undefined;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(req) {
      lastRequestHeaders = req.headers;
      const path = new URL(req.url).pathname;
      const route = routes.get(path);
      if (!route) return new Response("not found", { status: 404 });
      if (typeof route === "function") return route();
      return Response.json(route.body, { status: route.status ?? 200 });
    },
  });
});
afterAll(() => {
  server.stop(true);
});

function url(path: string): string {
  return `http://localhost:${server.port}${path}`;
}

function component(name: string, extra: Partial<RegistryItem> = {}): RegistryItem {
  const exportName = name[0]?.toUpperCase() + name.slice(1);
  return {
    name,
    type: "component",
    files: [{ path: `${exportName}.tsx`, content: `export const ${exportName} = () => null;` }],
    dependencies: [],
    registryDependencies: [],
    ...extra,
  } as RegistryItem;
}

describe("consify add (integration)", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-add-"));
    routes.clear();
    lastRequestHeaders = undefined;
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  const silent = async <T>(body: () => Promise<T>): Promise<{ result: T; out: string }> => {
    const log = console.log;
    const error = console.error;
    let out = "";
    console.log = (...a: unknown[]) => {
      out += `${a.join(" ")}\n`;
    };
    console.error = (...a: unknown[]) => {
      out += `${a.join(" ")}\n`;
    };
    try {
      const result = await body();
      return { result, out };
    } finally {
      console.log = log;
      console.error = error;
    }
  };

  test("installing a single component writes the file and a lockfile entry", async () => {
    routes.set("/thing.json", { body: component("thing") });
    const { result } = await silent(() =>
      runAddCommand({ specifier: url("/thing.json"), force: false }, cwd),
    );
    expect(result).toBe(0);
    expect(existsSync(join(cwd, "custom/components/Thing.tsx"))).toBe(true);
    const lockfile = readLockfile(cwd);
    expect(lockfile.items[url("/thing.json")]?.name).toBe("thing");
  });

  test("installing an item with one registryDependencies entry: both end up in the lockfile", async () => {
    routes.set("/badge.json", { body: component("badge") });
    routes.set("/card.json", {
      body: component("card", { registryDependencies: [url("/badge.json")] }),
    });
    const { result } = await silent(() =>
      runAddCommand({ specifier: url("/card.json"), force: false }, cwd),
    );
    expect(result).toBe(0);
    const lockfile = readLockfile(cwd);
    expect(lockfile.items[url("/card.json")]).toBeDefined();
    expect(lockfile.items[url("/badge.json")]).toBeDefined();
  });

  test("topologicalSort writes a dependency before the item that declared it", () => {
    const badge: FetchedItem = { item: component("badge"), sourceUrl: "https://x/badge.json" };
    const card: FetchedItem = {
      item: component("card", { registryDependencies: ["badge"] }),
      sourceUrl: "https://x/card.json",
    };
    const map = new Map([
      ["card", card],
      ["badge", badge],
    ]);
    const order = topologicalSort(map).map((entry) => entry.specifier);
    expect(order.indexOf("badge")).toBeLessThan(order.indexOf("card"));
  });

  test("a circular registryDependencies throws CliError naming the cycle", () => {
    const a: FetchedItem = {
      item: component("a", { registryDependencies: ["b"] }),
      sourceUrl: "https://x/a.json",
    };
    const b: FetchedItem = {
      item: component("b", { registryDependencies: ["a"] }),
      sourceUrl: "https://x/b.json",
    };
    const map = new Map([
      ["a", a],
      ["b", b],
    ]);
    expect(() => topologicalSort(map)).toThrow(/Circular registryDependencies/);
  });

  test("re-adding an unchanged item is a no-op", async () => {
    routes.set("/thing.json", { body: component("thing") });
    await silent(() => runAddCommand({ specifier: url("/thing.json"), force: false }, cwd));
    const { result, out } = await silent(() =>
      runAddCommand({ specifier: url("/thing.json"), force: false }, cwd),
    );
    expect(result).toBe(0);
    expect(out).toContain("already installed");
  });

  test("re-adding a locally-modified item without --force fails, with --force succeeds", async () => {
    routes.set("/thing.json", { body: component("thing") });
    await silent(() => runAddCommand({ specifier: url("/thing.json"), force: false }, cwd));
    writeFileSync(join(cwd, "custom/components/Thing.tsx"), "// modified by hand");

    // the lockfile entry is still there (it's "ours"), just no longer matching its recorded hash —
    // add.ts's own "already installed, nothing to do" short-circuit only applies when the file is
    // still unmodified, so a modified file is re-fetched and hits writeItems' conflict check.
    await expect(
      runAddCommand({ specifier: url("/thing.json"), force: false }, cwd),
    ).rejects.toThrow(/Thing\.tsx/);
    await expect(runAddCommand({ specifier: url("/thing.json"), force: true }, cwd)).resolves.toBe(
      0,
    );
    expect(readFileSync(join(cwd, "custom/components/Thing.tsx"), "utf8")).toContain(
      "export const Thing",
    );
  });

  test("installing a skill-type item prints the consify skill sync reminder", async () => {
    routes.set("/status-skill.json", {
      body: {
        name: "status-skill",
        type: "skill",
        files: [{ path: "SKILL.md", content: "---\nname: status\n---\n" }],
      },
    });
    const { out } = await silent(() =>
      runAddCommand({ specifier: url("/status-skill.json"), force: false }, cwd),
    );
    expect(out).toContain("consify skill sync");
  });

  describe("a feature-type item", () => {
    let spawnSpy: ReturnType<typeof spyOn>;
    beforeEach(() => {
      // `bun add @consify/blog` would otherwise really hit the npm registry from inside a test —
      // stub the actual package-manager invocation, same as any other test that shouldn't touch the
      // network, and just assert consify *asked* to install the right package. package-manager.ts
      // uses node:child_process.spawnSync (not Bun.spawnSync — see its own comment for why), so
      // that's what gets spied on here.
      spawnSpy = spyOn(childProcess, "spawnSync").mockReturnValue({
        status: 0,
        stdout: "",
        stderr: "",
      } as ReturnType<typeof childProcess.spawnSync>);
    });
    afterEach(() => {
      mock.restore();
    });

    test("runs bun add for packageName, writes no files, and prints the extensions snippet", async () => {
      // detectPackageManager falls back to sniffing a lockfile in cwd when npm_config_user_agent
      // isn't set (the case when `bun test` itself doesn't set it) — a bun.lock makes the choice
      // deterministic rather than depending on the environment this test happens to run in.
      writeFileSync(join(cwd, "bun.lock"), "");
      routes.set("/blog.json", {
        body: { name: "blog", type: "feature", packageName: "@consify/blog", exportName: "blog" },
      });
      const { result, out } = await silent(() =>
        runAddCommand({ specifier: url("/blog.json"), force: false }, cwd),
      );
      expect(result).toBe(0);
      expect(spawnSpy).toHaveBeenCalledWith(
        "bun",
        ["add", "@consify/blog"],
        expect.objectContaining({ cwd }),
      );
      expect(out).toContain('import { blog } from "@consify/blog";');
      expect(out).toContain("blog()");
      expect(existsSync(join(cwd, "custom"))).toBe(false);
      const lockfile = readLockfile(cwd);
      expect(lockfile.items[url("/blog.json")]?.files).toEqual([]);
      expect(lockfile.items[url("/blog.json")]?.packageName).toBe("@consify/blog");
      expect(out).not.toContain("skill sync");
    });

    test("an old-shape feature item (featureId + files) is rejected by the schema", async () => {
      routes.set("/legacy-feature.json", {
        body: {
          name: "status",
          type: "feature",
          featureId: "status",
          files: [{ path: "feature.ts", content: "export default {};" }],
        },
      });
      await expect(
        runAddCommand({ specifier: url("/legacy-feature.json"), force: false }, cwd),
      ).rejects.toThrow(/not a valid registry item/);
    });
  });

  test("installing a plain component does not mention consify skill sync", async () => {
    routes.set("/thing.json", { body: component("thing") });
    const { out } = await silent(() =>
      runAddCommand({ specifier: url("/thing.json"), force: false }, cwd),
    );
    expect(out).not.toContain("skill sync");
  });

  test("a namespaced specifier resolves through consify.registries.json and sends its configured header", async () => {
    routes.set("/r/thing.json", { body: component("thing") });
    writeRegistriesFile(cwd, {
      registries: {
        "@acme": { url: url("/r/{name}.json"), headers: { Authorization: "Bearer test-token" } },
      },
    });
    const { result } = await silent(() =>
      runAddCommand({ specifier: "@acme/thing", force: false }, cwd),
    );
    expect(result).toBe(0);
    expect(lastRequestHeaders?.get("authorization")).toBe("Bearer test-token");
    const lockfile = readLockfile(cwd);
    expect(lockfile.items["@acme/thing"]).toBeDefined();
  });

  test("a 404 response throws a CliError naming the status", async () => {
    await expect(
      runAddCommand({ specifier: url("/missing.json"), force: false }, cwd),
    ).rejects.toThrow(/404/);
  });
});
