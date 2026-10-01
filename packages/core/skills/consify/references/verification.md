# Verification

Run these in order. Do not finish while any of them fails. Take the commands from the project's
`package.json` (`build`, `typecheck`, `dev`); the examples use Bun.

## 1. Build

```bash
bun run build
```

MDX errors, YAML errors, and a front matter a feature's `schema` refuses (an unknown blog category
or author, a docs page without `title`) stop the build and name the file. Fix the cause. Do not
switch checks off.

## 2. Types

```bash
bun run typecheck
```

If the project has the script. It covers the config, `custom/components/`, `custom/features/`.

## 3. The content check

```bash
bunx consify check          # --strict: a missing translation is an error
consify lang status         # a quick table of what is translated per language
```

It exits with code 1 on an error:

- a feature cannot list its addresses (a front matter its `schema` refuses, a broken `meta.json`);
- a file is in a folder that is not a language of the site, or its front matter is not valid YAML;
- a translation has no original in the default language;
- a page has no file in another language (a warning; an error with `--strict`);
- code blocks, internal links and `href` values differ between a page and its translation, or the
  number of headings differs;
- a `meta.json` of a translation lists other pages than the original's;
- a `meta.json` lists a page or folder that does not exist (an error), or a page exists but is not
  listed when `pages` has no `"..."` (a warning).

## 4. Look at it

```bash
bun run dev
```

Open every new and changed page, in each language:

- the title, the description and the table of contents on the right look right;
- tables of options are readable, defaults are there;
- code blocks have the right file names and highlighting;
- diagrams read well in the light and in the dark theme;
- links lead to real pages (click several);
- a narrow window (a phone) does not break the page.

## 5. Report

Tell the user, briefly:

- which pages were created and changed (paths);
- what could not be checked and why;
- assumptions made and questions that remain (disputed facts, missing TSDoc, untranslated pages).

Do not commit. Say that the work is ready for review.
