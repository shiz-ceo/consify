import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { commonAncestor, withDocsivi } from "../src/next/config.ts";

const base = { site: { name: "D" } };

describe("deploy config", () => {
  test("defaults to server mode", () => {
    expect(defineConfig(base).deploy).toEqual({ mode: "server" });
  });

  test("basePath must start with / and not end with /", () => {
    expect(defineConfig({ ...base, deploy: { basePath: "/docs" } }).deploy.basePath).toBe("/docs");
    expect(() => defineConfig({ ...base, deploy: { basePath: "docs" } })).toThrow(/start with/);
    expect(() => defineConfig({ ...base, deploy: { basePath: "/docs/" } })).toThrow(/end with/);
  });

  test("unknown mode is rejected", () => {
    // @ts-expect-error invalid mode
    expect(() => defineConfig({ ...base, deploy: { mode: "edge" } })).toThrow();
  });
});

describe("withDocsivi", () => {
  test("server mode does not set output, always transpiles docsivi", () => {
    const config = withDocsivi(defineConfig(base));
    expect(config.output).toBeUndefined();
    expect(config.transpilePackages).toContain("docsivi");
    expect(config.serverExternalPackages).toContain("typescript");
  });

  test("static mode exports, base path is applied, user config wins", () => {
    const config = withDocsivi(
      defineConfig({ ...base, deploy: { mode: "static", basePath: "/x" } }),
      {
        transpilePackages: ["other"],
      },
    );
    expect(config.output).toBe("export");
    expect(config.basePath).toBe("/x");
    expect(config.images?.unoptimized).toBe(true);
    expect(config.transpilePackages).toEqual(["docsivi", "other"]);
  });
});

describe("commonAncestor", () => {
  test("finds the deepest shared directory", () => {
    expect(commonAncestor("/a/b/site", "/a/b/core/pkg")).toBe("/a/b");
    expect(commonAncestor("/a/site", "/x/core")).toBe("/");
  });
});
