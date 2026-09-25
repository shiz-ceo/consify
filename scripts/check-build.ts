// Checks the output of a build of the demo site: what a reader and a search engine would get.
// Builds the demo first (server mode), unless --skip-build is passed.
//
//   bun run scripts/check-build.ts [--skip-build]
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const demo = join(root, "apps", "demo");
const out = join(demo, "build", "client");

if (!process.argv.includes("--skip-build")) {
  const result = Bun.spawnSync(["bun", "run", "build:demo"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (result.exitCode !== 0) process.exit(1);
}

const failures: string[] = [];
const read = (path: string): string =>
  existsSync(join(out, path)) ? readFileSync(join(out, path), "utf8") : "";
function expect(name: string, condition: boolean): void {
  if (!condition) failures.push(name);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// pages of the site exist in every language
for (const lang of ["en", "ru"]) {
  expect(`/${lang} home`, read(`${lang}/index.html`).length > 0);
  expect(`/${lang}/docs/v2 page`, read(`${lang}/docs/v2/index.html`).length > 0);
  expect(`/${lang}/blog list`, read(`${lang}/blog/index.html`).length > 0);
  expect(`/${lang}/blog/rss.xml`, read(`${lang}/blog/rss.xml`).startsWith("<?xml"));
  expect(`/${lang}/llms.txt`, read(`${lang}/llms.txt`).length > 0);
}

// SEO tags of a page
const page = read("en/docs/v2/quickstart/index.html");
expect("title", /<title>[^<]+<\/title>/.test(page));
expect("description", /<meta name="description"/.test(page));
expect("canonical", /rel="canonical"/.test(page));
expect("open graph image", /property="og:image"/.test(page));
expect("hreflang", /hreflang="ru"/i.test(page));
expect("html lang", /<html lang="en"/.test(page));
expect("favicon", /rel="icon"/.test(page));

// a page without a translation: shown, marked, and not a duplicate
const fallback = read("ru/docs/v2/writing/plugins/index.html");
expect("fallback page is built", fallback.length > 0);
expect("fallback has the original language", /<html lang="en"/.test(fallback));
expect(
  "fallback points at the original",
  /rel="canonical" href="[^"]*\/en\/docs\/v2\/writing\/plugins"/.test(fallback),
);
expect("fallback has no hreflang for itself", !/hreflang="ru"/i.test(fallback));
const sitemap = read("sitemap.xml");
expect("sitemap has the translated page", sitemap.includes("/ru/docs/v2/quickstart"));
expect("sitemap leaves out the fallback page", !sitemap.includes("/ru/docs/v2/writing/plugins"));

// drafts and future posts never leave the source
const leaked = walk(out).filter((file) => {
  if (!/\.(html|js|xml|txt|data|json|css)$/.test(file)) return false;
  const text = readFileSync(file, "utf8");
  return text.includes("SECRET-DRAFT-MARKER") || text.includes("SECRET-FUTURE-MARKER");
});
expect(
  `no draft or future post in the output (${leaked.map((f) => f.replace(out, "")).join(", ")})`,
  leaked.length === 0,
);
expect("no draft page", !existsSync(join(out, "en/blog/draft-post")));
expect("no future page", !existsSync(join(out, "en/blog/future-post")));

// the blog
expect("blog has posts", /how the lattice scheduler sleeps/i.test(read("en/blog/index.html")));
expect("feed has items", (read("en/blog/rss.xml").match(/<item>/g) ?? []).length >= 3);

// robots and sitemap
expect("robots points at the sitemap", /Sitemap: /.test(read("robots.txt")));
expect("sitemap has blog posts", sitemap.includes("/en/blog/lattice-2"));

if (failures.length > 0) {
  console.error(
    `\n${failures.length} check(s) failed:\n${failures.map((f) => `  - ${f}`).join("\n")}`,
  );
  process.exit(1);
}
console.log("\nthe build output is as expected");
