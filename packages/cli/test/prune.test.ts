import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addNotFoundPage, pruneResourceData } from "../src/cli/spawn-commands.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("pruneResourceData", () => {
  test("removes the .data of a file, keeps the .data of a page", () => {
    const dir = mkdtempSync(join(tmpdir(), "consify-prune-"));
    dirs.push(dir);
    mkdirSync(join(dir, "en", "docs", "guide"), { recursive: true });
    for (const file of [
      "en/docs/guide/index.html",
      "en/docs/guide.data",
      "en/docs/guide.js",
      "en/docs/guide.js.data",
      "robots.txt",
      "robots.txt.data",
    ]) {
      writeFileSync(join(dir, file), "x");
    }
    expect(pruneResourceData(dir)).toBe(2);
    expect(existsSync(join(dir, "en/docs/guide.data"))).toBe(true);
    expect(existsSync(join(dir, "en/docs/guide.js"))).toBe(true);
    expect(existsSync(join(dir, "en/docs/guide.js.data"))).toBe(false);
    expect(existsSync(join(dir, "robots.txt.data"))).toBe(false);
  });
});

describe("addNotFoundPage", () => {
  test("the page of the site for any address is also 404.html, once", () => {
    const dir = mkdtempSync(join(tmpdir(), "consify-404-"));
    dirs.push(dir);
    writeFileSync(join(dir, "__spa-fallback.html"), "<html>site</html>");
    expect(addNotFoundPage(dir)).toBe(true);
    expect(readFileSync(join(dir, "404.html"), "utf8")).toBe("<html>site</html>");
    // a 404.html of the site itself is not replaced
    writeFileSync(join(dir, "404.html"), "own");
    expect(addNotFoundPage(dir)).toBe(false);
    expect(readFileSync(join(dir, "404.html"), "utf8")).toBe("own");
  });

  test("a server build has no such page: nothing is made", () => {
    const dir = mkdtempSync(join(tmpdir(), "consify-404-"));
    dirs.push(dir);
    expect(addNotFoundPage(dir)).toBe(false);
    expect(existsSync(join(dir, "404.html"))).toBe(false);
  });
});
