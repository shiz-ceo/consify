import { expect, test } from "bun:test";
import { languagePath } from "../src/shared/language-path.ts";

const languages = ["en", "ru"];
const at = (pathname: string, search = "", hash = "") => ({ pathname, search, hash });

test("swaps the language segment", () => {
  expect(languagePath(at("/en/docs/v1/a"), "ru", languages)).toBe("/ru/docs/v1/a");
});

test("drops the trailing slash a static host adds", () => {
  expect(languagePath(at("/en/docs/v1/a/"), "ru", languages)).toBe("/ru/docs/v1/a");
});

test("keeps the search and the hash", () => {
  expect(languagePath(at("/en/docs/a/", "?x=1", "#id"), "ru", languages)).toBe("/ru/docs/a?x=1#id");
});

test("the front page of a language", () => {
  expect(languagePath(at("/en"), "ru", languages)).toBe("/ru");
  expect(languagePath(at("/en/"), "ru", languages)).toBe("/ru");
});

test("an address without a language keeps its path", () => {
  expect(languagePath(at("/docs/a"), "ru", languages)).toBe("/ru/docs/a");
});
