import { describe, expect, test } from "bun:test";
import { parseRegistryItem, registryItemSchema } from "../../src/registry/schema.ts";

const validComponent = {
  name: "fancy-button",
  type: "component",
  files: [{ path: "fancy-button.tsx", content: "export const FancyButton = () => null;" }],
};

describe("registry item schema", () => {
  test("a minimal valid component item parses", () => {
    const result = registryItemSchema.safeParse(validComponent);
    expect(result.success).toBe(true);
  });

  test("a minimal valid feature item (packageName + exportName) parses", () => {
    const result = registryItemSchema.safeParse({
      name: "blog",
      type: "feature",
      packageName: "@consify/blog",
      exportName: "blog",
    });
    expect(result.success).toBe(true);
  });

  test("a feature item without packageName fails, naming the field", () => {
    const result = registryItemSchema.safeParse({
      name: "acme-tracker",
      type: "feature",
      exportName: "acmeTracker",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "packageName");
      expect(issue).toBeDefined();
    }
  });

  test("a feature item without exportName fails, naming the field", () => {
    const result = registryItemSchema.safeParse({
      name: "acme-tracker",
      type: "feature",
      packageName: "acme-tracker",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join(".") === "exportName");
      expect(issue).toBeDefined();
    }
  });

  test("a feature item with the old featureId/files shape is rejected as unrecognized keys", () => {
    const result = registryItemSchema.safeParse({
      name: "acme-tracker",
      type: "feature",
      packageName: "acme-tracker",
      exportName: "acmeTracker",
      featureId: "acme-tracker",
      files: [{ path: "feature.ts", content: "" }],
    });
    expect(result.success).toBe(false);
  });

  test("a skill item is files, like a component", () => {
    const result = registryItemSchema.safeParse({
      name: "acme-skill",
      type: "skill",
      files: [{ path: "SKILL.md", content: "" }],
    });
    expect(result.success).toBe(true);
  });

  test("a file path containing '..' fails", () => {
    const result = registryItemSchema.safeParse({
      ...validComponent,
      files: [{ path: "../../etc/cron.d/evil", content: "x" }],
    });
    expect(result.success).toBe(false);
  });

  test("a file path starting with '/' fails", () => {
    const result = registryItemSchema.safeParse({
      ...validComponent,
      files: [{ path: "/etc/passwd", content: "x" }],
    });
    expect(result.success).toBe(false);
  });

  test("two files with the same path fail", () => {
    const result = registryItemSchema.safeParse({
      ...validComponent,
      files: [
        { path: "a.tsx", content: "1" },
        { path: "a.tsx", content: "2" },
      ],
    });
    expect(result.success).toBe(false);
  });

  test("an unknown type value fails", () => {
    const result = registryItemSchema.safeParse({ ...validComponent, type: "widget" });
    expect(result.success).toBe(false);
  });

  test("the empty-files case fails", () => {
    const result = registryItemSchema.safeParse({ ...validComponent, files: [] });
    expect(result.success).toBe(false);
  });
});

describe("parseRegistryItem", () => {
  test("returns the parsed item on success", () => {
    expect(parseRegistryItem(validComponent, "https://example.com/r/fancy-button.json").name).toBe(
      "fancy-button",
    );
  });

  test("throws a CliError with a human message on failure", () => {
    expect(() =>
      parseRegistryItem({ type: "component" }, "https://example.com/r/bad.json"),
    ).toThrow(/is not a valid registry item/);
  });
});
