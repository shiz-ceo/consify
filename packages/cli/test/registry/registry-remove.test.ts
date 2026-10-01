import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readLockfile, sha256, writeLockfile } from "../../src/registry/lockfile.ts";
import { runRemoveCommand } from "../../src/registry/remove.ts";

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

function installComponent(cwd: string, key: string, name: string, content: string) {
  mkdirSync(join(cwd, "custom/components"), { recursive: true });
  const relPath = `custom/components/${name}.tsx`;
  writeFileSync(join(cwd, relPath), content);
  const lockfile = readLockfile(cwd);
  lockfile.set(key, {
    name,
    type: "component",
    source: `https://example.com/r/${name}.json`,
    installedAt: new Date().toISOString(),
    files: [{ path: relPath, hash: sha256(content) }],
    dependencies: [],
    registryDependencies: [],
  });
  writeLockfile(cwd, lockfile);
  return relPath;
}

describe("consify remove", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-remove-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("removing an installed item deletes its files and lockfile entry", async () => {
    const relPath = installComponent(
      cwd,
      "@acme/thing",
      "Thing",
      "export const Thing = () => null;",
    );
    const { result } = await silent(() =>
      runRemoveCommand({ specifier: "@acme/thing", force: false }, cwd),
    );
    expect(result).toBe(0);
    expect(existsSync(join(cwd, relPath))).toBe(false);
    expect(readLockfile(cwd).items["@acme/thing"]).toBeUndefined();
  });

  test("removing a specifier that isn't installed fails", async () => {
    await expect(runRemoveCommand({ specifier: "@acme/nope", force: false }, cwd)).rejects.toThrow(
      /is not installed/,
    );
  });

  test("removing an item another installed item depends on fails without --force, succeeds with it", async () => {
    installComponent(cwd, "@acme/badge", "Badge", "export const Badge = () => null;");
    const cardPath = installComponent(cwd, "@acme/card", "Card", "export const Card = () => null;");
    const lockfile = readLockfile(cwd);
    const cardEntry = lockfile.items["@acme/card"];
    if (cardEntry) cardEntry.registryDependencies = ["@acme/badge"];
    writeLockfile(cwd, lockfile);

    await expect(runRemoveCommand({ specifier: "@acme/badge", force: false }, cwd)).rejects.toThrow(
      /is a dependency of: Card/,
    );
    const { result } = await silent(() =>
      runRemoveCommand({ specifier: "@acme/badge", force: true }, cwd),
    );
    expect(result).toBe(0);
    expect(existsSync(join(cwd, cardPath))).toBe(true); // the dependent's own files are untouched
  });

  test("removing an item whose file was already manually deleted doesn't error", async () => {
    const relPath = installComponent(
      cwd,
      "@acme/thing",
      "Thing",
      "export const Thing = () => null;",
    );
    rmSync(join(cwd, relPath));
    const { result } = await silent(() =>
      runRemoveCommand({ specifier: "@acme/thing", force: false }, cwd),
    );
    expect(result).toBe(0);
    expect(readLockfile(cwd).items["@acme/thing"]).toBeUndefined();
  });

  test("removing an item whose file was locally modified keeps the file (with a warning) unless --force", async () => {
    const relPath = installComponent(
      cwd,
      "@acme/thing",
      "Thing",
      "export const Thing = () => null;",
    );
    writeFileSync(join(cwd, relPath), "// modified by hand");
    const { result, out } = await silent(() =>
      runRemoveCommand({ specifier: "@acme/thing", force: false }, cwd),
    );
    expect(result).toBe(0);
    expect(existsSync(join(cwd, relPath))).toBe(true);
    expect(out).toContain("kept");
    expect(readLockfile(cwd).items["@acme/thing"]).toBeUndefined();

    // re-seed and remove again with --force this time
    installComponent(cwd, "@acme/thing2", "Thing2", "export const Thing2 = () => null;");
    const relPath2 = "custom/components/Thing2.tsx";
    writeFileSync(join(cwd, relPath2), "// modified by hand");
    await silent(() => runRemoveCommand({ specifier: "@acme/thing2", force: true }, cwd));
    expect(existsSync(join(cwd, relPath2))).toBe(false);
  });

  test("removing a feature-type item deletes only the lockfile entry and warns the npm package stays", async () => {
    const lockfile = readLockfile(cwd);
    lockfile.set("blog", {
      name: "blog",
      type: "feature",
      source: "https://example.com/r/blog.json",
      installedAt: new Date().toISOString(),
      files: [],
      dependencies: [],
      registryDependencies: [],
      packageName: "@consify/blog",
    });
    writeLockfile(cwd, lockfile);

    const { result, out } = await silent(() =>
      runRemoveCommand({ specifier: "blog", force: false }, cwd),
    );
    expect(result).toBe(0);
    expect(readLockfile(cwd).items.blog).toBeUndefined();
    expect(out).toContain("was not removed");
    expect(out).toContain("uninstall @consify/blog");
  });
});
