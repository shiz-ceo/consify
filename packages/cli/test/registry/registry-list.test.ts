import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runListCommand } from "../../src/registry/list.ts";
import { readLockfile, sha256, writeLockfile } from "../../src/registry/lockfile.ts";

const silent = (body: () => number): { result: number; out: string } => {
  const log = console.log;
  let out = "";
  console.log = (...a: unknown[]) => {
    out += `${a.join(" ")}\n`;
  };
  try {
    return { result: body(), out };
  } finally {
    console.log = log;
  }
};

function seed(cwd: string, key: string, relPath: string, content: string) {
  mkdirSync(join(cwd, "custom/components"), { recursive: true });
  writeFileSync(join(cwd, relPath), content);
  const lockfile = readLockfile(cwd);
  lockfile.set(key, {
    name: key,
    type: "component",
    source: `https://example.com/r/${key}.json`,
    installedAt: new Date().toISOString(),
    files: [{ path: relPath, hash: sha256(content) }],
    dependencies: [],
    registryDependencies: [],
  });
  writeLockfile(cwd, lockfile);
}

describe("consify list", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-list-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("an empty lockfile prints the nothing-installed message", () => {
    const { result, out } = silent(() => runListCommand(cwd));
    expect(result).toBe(0);
    expect(out).toContain("Nothing installed from a registry yet.");
  });

  test("installed items print one line each", () => {
    seed(cwd, "thing", "custom/components/Thing.tsx", "export const Thing = () => null;");
    const { out } = silent(() => runListCommand(cwd));
    expect(out).toContain("thing");
    expect(out).toContain("component");
    expect(out).toContain("https://example.com/r/thing.json");
  });

  test("a locally-modified file shows the modified flag", () => {
    seed(cwd, "thing", "custom/components/Thing.tsx", "export const Thing = () => null;");
    writeFileSync(join(cwd, "custom/components/Thing.tsx"), "// edited by hand");
    const { out } = silent(() => runListCommand(cwd));
    expect(out).toContain("modified");
  });

  test("a deleted-but-still-locked file shows the missing files flag", () => {
    seed(cwd, "thing", "custom/components/Thing.tsx", "export const Thing = () => null;");
    rmSync(join(cwd, "custom/components/Thing.tsx"));
    const { out } = silent(() => runListCommand(cwd));
    expect(out).toContain("missing files");
  });
});
