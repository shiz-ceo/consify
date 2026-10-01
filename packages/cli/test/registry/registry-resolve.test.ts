import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { RegistriesFile } from "../../src/registry/config.ts";
import { interpolateEnv, resolveSpecifier } from "../../src/registry/resolve.ts";

describe("resolveSpecifier", () => {
  test("a full URL passes through unchanged", () => {
    const resolved = resolveSpecifier("https://example.com/r/foo.json", { registries: {} });
    expect(resolved).toEqual({
      url: "https://example.com/r/foo.json",
      headers: {},
      displaySpecifier: "https://example.com/r/foo.json",
    });
  });

  test("@ns/name with a configured namespace resolves correctly", () => {
    const registries: RegistriesFile = {
      registries: { "@acme": { url: "https://acme.dev/r/{name}.json" } },
    };
    const resolved = resolveSpecifier("@acme/button", registries);
    expect(resolved.url).toBe("https://acme.dev/r/button.json");
    expect(resolved.displaySpecifier).toBe("@acme/button");
  });

  test("@ns/name with an unconfigured namespace throws CliError listing what is configured", () => {
    const registries: RegistriesFile = {
      registries: { "@acme": { url: "https://acme.dev/r/{name}.json" } },
    };
    expect(() => resolveSpecifier("@other/button", registries)).toThrow(/Configured: @acme/);
  });

  test("a bare name with no registries configured at all throws CliError", () => {
    expect(() => resolveSpecifier("@other/button", { registries: {} })).toThrow(
      /No registries configured yet/,
    );
  });

  test("a bare name with a configured default resolves", () => {
    const registries: RegistriesFile = {
      registries: { "@acme": { url: "https://acme.dev/r/{name}.json", default: true } },
    };
    const resolved = resolveSpecifier("button", registries);
    expect(resolved.url).toBe("https://acme.dev/r/button.json");
  });

  test("a bare name with no default configured throws CliError", () => {
    const registries: RegistriesFile = {
      registries: { "@acme": { url: "https://acme.dev/r/{name}.json" } },
    };
    expect(() => resolveSpecifier("button", registries)).toThrow(
      /no registry is marked as default/,
    );
  });

  test("a template URL with {name} appearing twice gets both occurrences replaced", () => {
    const registries: RegistriesFile = {
      registries: { "@acme": { url: "https://acme.dev/{name}/r/{name}.json" } },
    };
    const resolved = resolveSpecifier("@acme/button", registries);
    expect(resolved.url).toBe("https://acme.dev/button/r/button.json");
  });
});

describe("interpolateEnv", () => {
  const originalValue = process.env.CONSIFY_TEST_TOKEN;
  beforeEach(() => {
    delete process.env.CONSIFY_TEST_TOKEN;
  });
  afterEach(() => {
    if (originalValue === undefined) delete process.env.CONSIFY_TEST_TOKEN;
    else process.env.CONSIFY_TEST_TOKEN = originalValue;
  });

  test("a header value referencing ${UNSET_VAR} throws CliError naming the variable", () => {
    expect(() => interpolateEnv({ Authorization: "Bearer ${CONSIFY_TEST_TOKEN}" })).toThrow(
      /CONSIFY_TEST_TOKEN/,
    );
  });

  test("a header value referencing ${SET_VAR} resolves to the real value", () => {
    process.env.CONSIFY_TEST_TOKEN = "secret-value";
    expect(interpolateEnv({ Authorization: "Bearer ${CONSIFY_TEST_TOKEN}" })).toEqual({
      Authorization: "Bearer secret-value",
    });
  });
});
