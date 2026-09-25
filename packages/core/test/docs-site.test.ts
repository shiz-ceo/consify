import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { docsConfigSchema } from "../src/config/index.ts";

const reference = readFileSync(
  join(import.meta.dir, "../../../apps/docs/content/docs/v0/reference/config.mdx"),
  "utf8",
);

describe("the documentation site", () => {
  test("the configuration reference mentions every top-level option of the config", () => {
    const keys = Object.keys(docsConfigSchema.shape);
    expect(keys.length).toBeGreaterThan(10);
    const missing = keys.filter((key) => !new RegExp(`\\b${key}\\b`).test(reference));
    expect(missing).toEqual([]);
  });
});
