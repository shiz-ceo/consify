import { describe, expect, test } from "bun:test";
import { defineConfig } from "../src/config/index.ts";
import { slotsFromGlob } from "../src/shared/slots.ts";

describe("slotsFromGlob", () => {
  const Other = () => null;
  const Header = () => null;
  const End = () => null;
  const Footer = () => null;

  test("maps the files of custom/ to the slots", () => {
    const slots = slotsFromGlob({
      "/custom/header.tsx": { default: Header, End },
      "/custom/footer.jsx": { default: Footer },
    });
    expect(slots).toEqual({ Header, HeaderEnd: End, Footer });
  });

  test("ignores other files and modules without a default export", () => {
    expect(
      slotsFromGlob({
        "/custom/other.tsx": { default: Other },
        "/custom/header.tsx": {},
        "/custom/components/Footer.tsx": { default: Footer },
      }),
    ).toEqual({});
  });
});

describe("slots in the config", () => {
  test("accepts components and rejects anything else", () => {
    const Footer = () => null;
    expect(defineConfig({ site: { name: "D" }, slots: { footer: Footer } }).slots?.footer).toBe(
      Footer,
    );
    expect(() =>
      defineConfig({ site: { name: "D" }, slots: { footer: "nope" } } as never),
    ).toThrow();
    expect(() =>
      defineConfig({ site: { name: "D" }, slots: { sidebar: Footer } } as never),
    ).toThrow();
  });
});
