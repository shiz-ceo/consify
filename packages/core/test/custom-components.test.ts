import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCustomComponents, syncCustomComponents } from "../src/next/custom-components.ts";

let cwd: string;

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "docsivi-"));
});
afterEach(() => {
  rmSync(cwd, { recursive: true, force: true });
});

function addComponents(...files: string[]) {
  mkdirSync(join(cwd, "custom/components"), { recursive: true });
  for (const file of files)
    writeFileSync(join(cwd, "custom/components", file), "export default null;");
}

describe("custom components registry", () => {
  test("no folder gives an empty registry", () => {
    expect(syncCustomComponents({ cwd })).toEqual([]);
    const out = readFileSync(join(cwd, ".docsivi/components.generated.ts"), "utf8");
    expect(out).toContain("export const customComponents = {  };");
  });

  test("only PascalCase .tsx/.jsx files become components", () => {
    addComponents(
      "Pricing.tsx",
      "Chart.jsx",
      "helper.ts",
      "lowercase.tsx",
      "styles.css",
      "Readme.md",
    );
    expect(findCustomComponents({ cwd })).toEqual(["Chart", "Pricing"]);
    expect(syncCustomComponents({ cwd })).toEqual(["Chart", "Pricing"]);
    const out = readFileSync(join(cwd, ".docsivi/components.generated.ts"), "utf8");
    expect(out).toContain('import Chart from "../custom/components/Chart";');
    expect(out).toContain('import Pricing from "../custom/components/Pricing";');
    expect(out).toContain("export const customComponents = { Chart, Pricing };");
  });

  test("does not rewrite an unchanged registry", () => {
    addComponents("Pricing.tsx");
    syncCustomComponents({ cwd });
    const path = join(cwd, ".docsivi/components.generated.ts");
    const before = Bun.file(path).lastModified;
    Bun.sleepSync(20);
    syncCustomComponents({ cwd });
    expect(Bun.file(path).lastModified).toBe(before);
  });

  test("picks up an added component", () => {
    addComponents("A.tsx");
    syncCustomComponents({ cwd });
    addComponents("B.tsx");
    expect(syncCustomComponents({ cwd })).toEqual(["A", "B"]);
  });
});
