# Verification

Run these in order. Do not finish while any of them fails. Take the commands from the project's
`package.json` (`build`, `typecheck`, `dev`); the examples use Bun.

## 1. Build

```bash
bun run build
```

MDX errors, YAML errors, and an unknown category or author in a post stop the build and name the
file. Fix the cause. Do not switch checks off.

## 2. Types

```bash
bun run typecheck
```

If the project has the script. It covers the config and the components in `custom/`.

## 3. The check script

```bash
bun run .claude/skills/consify-docs/scripts/check-docs.ts
# options: --root <project>  --languages en,ru  --strict
```

It reports problems and exits with code 1 when it finds an error:

- a page in the main language has no file for one of the languages (an error with `--strict`,
  otherwise a warning), and a translation has no original;
- a `meta.json` has no `meta.<language>.json`, or the two list different pages;
- code blocks, internal links and `href` values differ between a page and its translation, or the
  number of headings differs;
- a page or folder is not listed in the `pages` of its `meta.json` (when `pages` has no `"..."`), or a
  listed name does not exist;
- front matter is missing `title` or `description`, or has an unquoted value with `: ` or ` #`;
- a blog post is missing `title`, `description` or `date`.

If the skill lives elsewhere in the project, use that path.

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
