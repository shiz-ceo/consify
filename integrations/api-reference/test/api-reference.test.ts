import { describe, expect, test } from "bun:test";
import { defineConfig, linkCatalog } from "@consify/core";
import { siteAddresses } from "@consify/core/node";
import { apiReference } from "../src/index.ts";

const site = { name: "D" };

describe("apiReference()", () => {
  test("is a page at /{lang}/api with a link in the header", async () => {
    const config = defineConfig({
      site,
      i18n: { languages: ["en", "ru"] },
      features: [apiReference({ input: "./openapi.json" })],
    });
    expect(linkCatalog(config, "ru")).toEqual([
      expect.objectContaining({ id: "api", title: "API", url: "/ru/api", primary: true }),
    ]);
    const urls = (await siteAddresses(config, "/nowhere"))
      .filter((a) => a.feature.id === "api")
      .map((a) => a.url);
    expect(urls).toEqual(["/en/api", "/ru/api"]);
  });

  test("a second one has its own id, address and title", () => {
    const config = defineConfig({
      site,
      features: [
        apiReference({ input: "./openapi.json" }),
        apiReference({ id: "admin-api", input: "./admin.json", title: "Admin API" }),
      ],
    });
    expect(linkCatalog(config, "en").map((l) => [l.id, l.title, l.url])).toEqual([
      ["api", "API", "/en/api"],
      ["admin-api", "Admin API", "/en/admin-api"],
    ]);
  });

  test("two with the same id are refused", () => {
    expect(() =>
      defineConfig({
        site,
        features: [apiReference({ input: "a" }), apiReference({ input: "b" })],
      }),
    ).toThrow(/duplicate feature "api"/);
  });
});
