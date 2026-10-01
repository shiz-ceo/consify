import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLocale } from "../src/locale-command.ts";

describe("consify locale", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-locale-cmd-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("`consify locale` writes the file, refuses to replace it, and checks the code", async () => {
    writeFileSync(
      join(cwd, "docs.config.ts"),
      `export default { i18n: { languages: ["en"] }, features: [], mdx: { plugins: [] } };`,
    );
    const log = console.log;
    const error = console.error;
    console.log = () => {};
    console.error = () => {};
    try {
      expect(await runLocale({ language: "de" }, cwd)).toBe(0);
      expect(readFileSync(join(cwd, "custom/locales/de.ts"), "utf8")).toContain("defineLocale");
      expect(await runLocale({ language: "de" }, cwd)).toBe(1);
      expect(await runLocale({ language: "de", force: true }, cwd)).toBe(0);
      expect(await runLocale({ language: "Not A Code" }, cwd)).toBe(1);
      expect(await runLocale({ language: undefined }, cwd)).toBe(1);
    } finally {
      console.log = log;
      console.error = error;
    }
  });
});
