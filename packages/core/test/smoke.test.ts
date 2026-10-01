import { expect, test } from "bun:test";
import { version } from "../src/index.ts";

test("core exports a version", () => {
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});
