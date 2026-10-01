import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readRegistriesFile } from "../../src/registry/config.ts";
import { addSource, listSources, removeSource } from "../../src/registry/sources.ts";

const silent = <T>(body: () => T): { result: T; out: string } => {
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

describe("consify registry add-source / remove-source / list-sources", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-sources-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("adding a new source writes it correctly", () => {
    addSource({ namespace: "@acme", url: "https://acme.dev/r/{name}.json" }, cwd);
    expect(readRegistriesFile(cwd).registries["@acme"]?.url).toBe("https://acme.dev/r/{name}.json");
  });

  test("adding an existing namespace without --force fails, with --force overwrites", () => {
    addSource({ namespace: "@acme", url: "https://acme.dev/r/{name}.json" }, cwd);
    expect(() =>
      addSource({ namespace: "@acme", url: "https://other.dev/r/{name}.json" }, cwd),
    ).toThrow(/already configured/);
    addSource({ namespace: "@acme", url: "https://other.dev/r/{name}.json", force: true }, cwd);
    expect(readRegistriesFile(cwd).registries["@acme"]?.url).toBe(
      "https://other.dev/r/{name}.json",
    );
  });

  test("marking a new source --default clears any previous default", () => {
    addSource({ namespace: "@acme", url: "https://acme.dev/r/{name}.json", default: true }, cwd);
    addSource({ namespace: "@other", url: "https://other.dev/r/{name}.json", default: true }, cwd);
    const file = readRegistriesFile(cwd);
    expect(file.registries["@acme"]?.default).toBeUndefined();
    expect(file.registries["@other"]?.default).toBe(true);
  });

  test("--header values are stored and interpolated later, never logged as their resolved value", () => {
    process.env.CONSIFY_TEST_SOURCE_TOKEN = "super-secret-value";
    try {
      const { out } = silent(() =>
        addSource(
          {
            namespace: "@internal",
            url: "https://internal.dev/r/{name}.json",
            header: ["Authorization: Bearer ${CONSIFY_TEST_SOURCE_TOKEN}"],
          },
          cwd,
        ),
      );
      expect(out).not.toContain("super-secret-value");
      const file = readRegistriesFile(cwd);
      expect(file.registries["@internal"]?.headers?.Authorization).toBe(
        "Bearer ${CONSIFY_TEST_SOURCE_TOKEN}",
      );
    } finally {
      delete process.env.CONSIFY_TEST_SOURCE_TOKEN;
    }
  });

  test("removing a nonexistent namespace fails with a clear message", () => {
    expect(() => removeSource("@nope", cwd)).toThrow(/is not configured/);
  });

  test("removing an existing namespace deletes it, leaving others alone", () => {
    addSource({ namespace: "@acme", url: "https://acme.dev/r/{name}.json" }, cwd);
    addSource({ namespace: "@other", url: "https://other.dev/r/{name}.json" }, cwd);
    removeSource("@acme", cwd);
    const file = readRegistriesFile(cwd);
    expect(file.registries["@acme"]).toBeUndefined();
    expect(file.registries["@other"]).toBeDefined();
  });

  test('listSources on an empty file prints the "no registries configured" message verbatim', () => {
    const { out } = silent(() => listSources(cwd));
    expect(out).toBe("No registries configured. consify registry add-source <namespace> <url>\n");
  });

  test("listSources never prints a raw resolved header value", () => {
    process.env.CONSIFY_TEST_SOURCE_TOKEN = "super-secret-value";
    try {
      addSource(
        {
          namespace: "@internal",
          url: "https://internal.dev/r/{name}.json",
          header: ["Authorization: Bearer ${CONSIFY_TEST_SOURCE_TOKEN}"],
        },
        cwd,
      );
      const { out } = silent(() => listSources(cwd));
      expect(out).not.toContain("super-secret-value");
      expect(out).toContain("auth: yes");
    } finally {
      delete process.env.CONSIFY_TEST_SOURCE_TOKEN;
    }
  });
});
