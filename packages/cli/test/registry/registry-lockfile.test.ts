import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFile, readLockfile, sha256, writeLockfile } from "../../src/registry/lockfile.ts";

describe("consify.registry-lock.json", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-lockfile-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("reading a nonexistent lockfile returns an empty one", () => {
    expect(readLockfile(cwd).data).toEqual({ version: 1, items: {} });
  });

  test("round-trip read/write", () => {
    const handle = readLockfile(cwd);
    handle.set("@acme/badge", {
      name: "badge",
      type: "component",
      source: "https://acme.dev/r/badge.json",
      installedAt: new Date().toISOString(),
      files: [{ path: "custom/components/Badge.tsx", hash: sha256("x") }],
      dependencies: [],
      registryDependencies: [],
    });
    writeLockfile(cwd, handle);
    const reread = readLockfile(cwd);
    expect(reread.items["@acme/badge"]?.name).toBe("badge");
  });

  test("hashFile produces a stable hash for the same content written twice", () => {
    const path = join(cwd, "a.txt");
    writeFileSync(path, "hello world");
    const first = hashFile(path);
    writeFileSync(path, "hello world");
    expect(hashFile(path)).toBe(first);
    expect(first).toBe(sha256("hello world"));
  });

  test("findByPath finds an entry by its recorded relative path, undefined for untracked", () => {
    const handle = readLockfile(cwd);
    handle.set("@acme/badge", {
      name: "badge",
      type: "component",
      source: "https://acme.dev/r/badge.json",
      installedAt: new Date().toISOString(),
      files: [{ path: "custom/components/Badge.tsx", hash: "sha256:abc" }],
      dependencies: [],
      registryDependencies: [],
    });
    expect(handle.findByPath(join(cwd, "custom/components/Badge.tsx"))?.hash).toBe("sha256:abc");
    expect(handle.findByPath(join(cwd, "custom/components/Other.tsx"))).toBeUndefined();
  });

  test("an invalid lockfile (bad version) throws CliError", () => {
    writeFileSync(
      join(cwd, "consify.registry-lock.json"),
      JSON.stringify({ version: 2, items: {} }),
    );
    expect(() => readLockfile(cwd)).toThrow();
  });

  test("an invalid lockfile (malformed entry) throws CliError", () => {
    writeFileSync(
      join(cwd, "consify.registry-lock.json"),
      JSON.stringify({ version: 1, items: { x: { name: "x" } } }),
    );
    expect(() => readLockfile(cwd)).toThrow();
  });
});
