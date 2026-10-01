import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveItemRoot } from "../../src/registry/item-types.ts";
import type { RegistryItem } from "../../src/registry/schema.ts";

function item(overrides: Record<string, unknown>): RegistryItem {
  return {
    name: "thing",
    type: "component",
    files: [{ path: "Thing.tsx", content: "" }],
    dependencies: [],
    registryDependencies: [],
    ...overrides,
  } as RegistryItem;
}

/** `resolveItemRoot` is never called for a `feature` item (see item-types.ts) — this narrows the
 *  test helper's return type for call sites that build a component/plugin/skill/theme item. */
function notFeature(registryItem: RegistryItem): Exclude<RegistryItem, { type: "feature" }> {
  return registryItem as Exclude<RegistryItem, { type: "feature" }>;
}

describe("resolveItemRoot", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "consify-item-types-"));
  });
  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  test("component -> custom/components", () => {
    expect(resolveItemRoot(notFeature(item({ type: "component" })), cwd)).toBe(
      join(cwd, "custom/components"),
    );
  });

  test("plugin -> custom/plugins", () => {
    expect(resolveItemRoot(notFeature(item({ type: "plugin" })), cwd)).toBe(
      join(cwd, "custom/plugins"),
    );
  });

  test("skill -> custom/skills/<name>", () => {
    expect(resolveItemRoot(notFeature(item({ type: "skill" })), cwd)).toBe(
      join(cwd, "custom/skills", item({ type: "skill" }).name),
    );
  });

  test("theme -> custom (a theme item's files land directly under custom/, e.g. custom/theme.css)", () => {
    expect(resolveItemRoot(notFeature(item({ type: "theme" })), cwd)).toBe(join(cwd, "custom"));
  });
});
