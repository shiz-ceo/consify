import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { fetchRegistryItem } from "../../src/registry/fetch.ts";

const resolved = {
  url: "https://example.com/r/thing.json",
  headers: {},
  displaySpecifier: "thing",
};

const validItemJson = {
  name: "thing",
  type: "component",
  files: [{ path: "Thing.tsx", content: "export const Thing = () => null;" }],
};

describe("fetchRegistryItem", () => {
  let fetchSpy: ReturnType<typeof spyOn>;
  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("a successful fetch + valid JSON parses into a RegistryItem", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify(validItemJson), { status: 200 }));
    const fetched = await fetchRegistryItem(resolved);
    expect(fetched.item.name).toBe("thing");
    expect(fetched.sourceUrl).toBe(resolved.url);
  });

  test("a non-2xx response throws CliError naming the status", async () => {
    fetchSpy.mockResolvedValue(new Response("nope", { status: 404, statusText: "Not Found" }));
    await expect(fetchRegistryItem(resolved)).rejects.toThrow(/404/);
  });

  test("invalid JSON throws CliError", async () => {
    fetchSpy.mockResolvedValue(new Response("not json{", { status: 200 }));
    await expect(fetchRegistryItem(resolved)).rejects.toThrow(/did not return valid JSON/);
  });

  test("JSON that fails schema validation throws CliError with the validation detail", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ type: "component" }), { status: 200 }),
    );
    await expect(fetchRegistryItem(resolved)).rejects.toThrow(/is not a valid registry item/);
  });

  test("a network error throws CliError naming the url", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(fetchRegistryItem(resolved)).rejects.toThrow(/Could not reach/);
  });
});
