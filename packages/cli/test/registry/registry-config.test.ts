import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  readRegistriesFile,
  registriesFileSchema,
  writeRegistriesFile,
} from "../../src/registry/config.ts";

describe("consify.registries.json", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-registry-config-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("reading a nonexistent file returns { registries: {} }", () => {
    expect(readRegistriesFile(cwd)).toEqual({ registries: {} });
  });

  test("a valid file round-trips through read/write unchanged", () => {
    const file = {
      registries: {
        "@shiz-ceo": { url: "https://consify.shiz-ceo.ru/r/{name}.json", default: true },
        "@acme": { url: "https://acme.dev/r/{name}.json" },
      },
    };
    writeRegistriesFile(cwd, file);
    expect(readRegistriesFile(cwd)).toEqual(file);
    expect(readFileSync(join(cwd, "consify.registries.json"), "utf8")).toContain("@shiz-ceo");
  });

  test("two entries both marked default: true fails validation", () => {
    const result = registriesFileSchema.safeParse({
      registries: {
        "@a": { url: "https://a.dev/{name}.json", default: true },
        "@b": { url: "https://b.dev/{name}.json", default: true },
      },
    });
    expect(result.success).toBe(false);
  });

  test("an invalid namespace key (not starting with @) fails", () => {
    const result = registriesFileSchema.safeParse({
      registries: { acme: { url: "https://acme.dev/{name}.json" } },
    });
    expect(result.success).toBe(false);
  });

  test("a url without {name} fails", () => {
    const result = registriesFileSchema.safeParse({
      registries: { "@acme": { url: "https://acme.dev/registry.json" } },
    });
    expect(result.success).toBe(false);
  });

  test("an existing but invalid file throws CliError", () => {
    const path = join(cwd, "consify.registries.json");
    writeFileSync(path, "{ not json");
    expect(() => readRegistriesFile(cwd)).toThrow();
  });
});
