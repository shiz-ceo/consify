import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FetchedItem } from "../../src/registry/fetch.ts";
import { hashFile, readLockfile, sha256 } from "../../src/registry/lockfile.ts";
import type { RegistryItem } from "../../src/registry/schema.ts";
import { writeItems } from "../../src/registry/write.ts";

type FileItem = Exclude<RegistryItem, { type: "feature" }>;

function componentItem(name: string, content = `export const ${name} = () => null;`): FileItem {
  return {
    name,
    type: "component",
    files: [{ path: `${name}.tsx`, content }],
    dependencies: [],
    registryDependencies: [],
  } as FileItem;
}

function fetched(item: RegistryItem, sourceUrl = "https://example.com/r/x.json"): FetchedItem {
  return { item, sourceUrl };
}

describe("writeItems", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-registry-write-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("writing a fresh component item creates the file and a lockfile entry with the correct hash", () => {
    const lockfile = readLockfile(cwd);
    const item = componentItem("Thing");
    writeItems(
      [{ fetched: fetched(item), specifier: "@acme/thing" }],
      lockfile,
      { force: false },
      cwd,
    );

    const filePath = join(cwd, "custom/components/Thing.tsx");
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf8")).toContain("Thing");
    const entry = lockfile.items["@acme/thing"];
    expect(entry?.name).toBe("Thing");
    expect(entry?.files[0]?.hash).toBe(sha256(item.files[0]?.content ?? ""));
  });

  test("re-running the same install with an unchanged on-disk file and no --force is a no-op (no conflict)", () => {
    const lockfile = readLockfile(cwd);
    const item = componentItem("Thing");
    writeItems(
      [{ fetched: fetched(item), specifier: "@acme/thing" }],
      lockfile,
      { force: false },
      cwd,
    );
    // re-seed a "fresh" lockfile handle pointed at the same on-disk state, matching hash already recorded
    expect(() =>
      writeItems(
        [{ fetched: fetched(item), specifier: "@acme/thing" }],
        lockfile,
        { force: false },
        cwd,
      ),
    ).not.toThrow();
  });

  test("a locally-modified file (hash mismatch) without --force throws CliError listing the path", () => {
    const lockfile = readLockfile(cwd);
    const item = componentItem("Thing");
    writeItems(
      [{ fetched: fetched(item), specifier: "@acme/thing" }],
      lockfile,
      { force: false },
      cwd,
    );
    writeFileSync(join(cwd, "custom/components/Thing.tsx"), "// locally modified");

    const changed = componentItem("Thing", "export const Thing = () => 'changed';");
    expect(() =>
      writeItems(
        [{ fetched: fetched(changed), specifier: "@acme/thing" }],
        lockfile,
        { force: false },
        cwd,
      ),
    ).toThrow(/Thing\.tsx/);
  });

  test("the same locally-modified file with --force succeeds and overwrites", () => {
    const lockfile = readLockfile(cwd);
    const item = componentItem("Thing");
    writeItems(
      [{ fetched: fetched(item), specifier: "@acme/thing" }],
      lockfile,
      { force: false },
      cwd,
    );
    writeFileSync(join(cwd, "custom/components/Thing.tsx"), "// locally modified");

    const changed = componentItem("Thing", "export const Thing = () => 'changed';");
    writeItems(
      [{ fetched: fetched(changed), specifier: "@acme/thing" }],
      lockfile,
      { force: true },
      cwd,
    );
    expect(readFileSync(join(cwd, "custom/components/Thing.tsx"), "utf8")).toContain("changed");
  });

  test("a file that exists but was written by a foreign process (not in the lockfile) is a conflict", () => {
    const lockfile = readLockfile(cwd);
    const item = componentItem("Thing");
    const filePath = join(cwd, "custom/components/Thing.tsx");
    mkdirSync(join(cwd, "custom/components"), { recursive: true });
    writeFileSync(filePath, "// not ours");
    expect(() =>
      writeItems(
        [{ fetched: fetched(item), specifier: "@acme/thing" }],
        lockfile,
        { force: false },
        cwd,
      ),
    ).toThrow();
  });

  test("a theme item writes its files under custom/ and gets a normal lockfile entry", () => {
    const lockfile = readLockfile(cwd);
    const themeItem = {
      name: "brand",
      type: "theme",
      files: [{ path: "theme.css", content: ':root { --brand: "#123"; }' }],
      dependencies: [],
      registryDependencies: [],
    } as FileItem;
    writeItems(
      [{ fetched: fetched(themeItem), specifier: "@acme/brand" }],
      lockfile,
      { force: false },
      cwd,
    );

    const filePath = join(cwd, "custom/theme.css");
    expect(existsSync(filePath)).toBe(true);
    expect(readFileSync(filePath, "utf8")).toContain("--brand");
    const entry = lockfile.items["@acme/brand"];
    expect(entry?.name).toBe("brand");
    expect(entry?.files[0]?.hash).toBe(sha256(themeItem.files[0]?.content ?? ""));
  });

  test("a theme item conflicting with an unmanaged file throws, same as component/plugin", () => {
    const lockfile = readLockfile(cwd);
    const themeItem = {
      name: "brand",
      type: "theme",
      files: [{ path: "theme.css", content: ":root {}" }],
      dependencies: [],
      registryDependencies: [],
    } as FileItem;
    mkdirSync(join(cwd, "custom"), { recursive: true });
    writeFileSync(join(cwd, "custom/theme.css"), "/* not ours */");
    expect(() =>
      writeItems(
        [{ fetched: fetched(themeItem), specifier: "@acme/brand" }],
        lockfile,
        { force: false },
        cwd,
      ),
    ).toThrow(/theme\.css/);
  });

  test("a feature item writes no files, prints the extensions snippet, and gets a lockfile entry with empty files", () => {
    const lockfile = readLockfile(cwd);
    const featureItem = {
      name: "blog",
      type: "feature",
      packageName: "@consify/blog",
      exportName: "blog",
      dependencies: [],
      registryDependencies: [],
    } as RegistryItem;

    const logs: string[] = [];
    const log = console.log;
    console.log = (msg?: unknown) => {
      logs.push(String(msg));
    };
    try {
      writeItems(
        [{ fetched: fetched(featureItem), specifier: "blog" }],
        lockfile,
        { force: false },
        cwd,
      );
    } finally {
      console.log = log;
    }

    expect(existsSync(join(cwd, "custom"))).toBe(false);
    const entry = lockfile.items.blog;
    expect(entry?.name).toBe("blog");
    expect(entry?.files).toEqual([]);
    expect(entry?.packageName).toBe("@consify/blog");
    const output = logs.join("\n");
    expect(output).toContain('import { blog } from "@consify/blog";');
    expect(output).toContain("blog()");
  });

  test("re-running a feature install is a conflict-free no-op path (no files to conflict on)", () => {
    const lockfile = readLockfile(cwd);
    const featureItem = {
      name: "blog",
      type: "feature",
      packageName: "@consify/blog",
      exportName: "blog",
      dependencies: [],
      registryDependencies: [],
    } as RegistryItem;
    writeItems(
      [{ fetched: fetched(featureItem), specifier: "blog" }],
      lockfile,
      { force: false },
      cwd,
    );
    expect(() =>
      writeItems(
        [{ fetched: fetched(featureItem), specifier: "blog" }],
        lockfile,
        { force: false },
        cwd,
      ),
    ).not.toThrow();
  });
});
