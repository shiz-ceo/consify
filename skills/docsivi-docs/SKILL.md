---
name: docsivi-docs
description: Write and maintain documentation for a project that uses docsivi (a configurable documentation site foundation). Interviews the user first (languages, versions, audience, sections), then writes MDX pages from the project's source code and TSDoc, keeps docs.config.ts, meta.json and translations in sync, and adds custom MDX components or plugins in custom/ when needed. Use when the user asks to document a project, write or update docs pages, add a language or a version, plan the structure of a docs site, translate pages, write a blog post for the docs site, or check that the docs match the code.
---

# docsivi documentation

docsivi is a foundation for documentation sites. A project that uses it consists of `docs.config.ts`,
a `content/` folder and, optionally, `custom/`. This skill writes and maintains the documentation of
the **user's own product** (a library, an application, an API) inside such a project, in the format
docsivi expects.

The user has the `docsivi` package installed. They do not have, and must not need, access to its
source repository. Everything the skill does happens in the user's project.

## What this skill does not do

- It does not write TSDoc or code comments. It assumes the code has them. When something the docs
  need is undocumented in the code, say **where** and ask what to do. Do not invent the missing facts.
- It does not create documentation for AI agents (`ai-docs/`, `AGENTS.md`) and does not run TypeDoc.
- It does not change the user's source code or anything inside `node_modules/docsivi`.
- It does not edit `README.md` or `CHANGELOG.md`.
- It does not commit. Commit only when the user says so.
- It does not make facts up. If a claim cannot be verified, leave it out or mark it as unverified
  and ask.

## Where facts come from

| What | Source |
| --- | --- |
| Behavior and API of the user's product | Their source code and TSDoc, tests, README, and the user's answers |
| docsivi options (config keys, types, defaults) | `node_modules/docsivi/src/config/schema.ts` (Zod schema with TSDoc). If only compiled files are shipped, use the `.d.ts` types and the docsivi documentation at `<docsivi docs URL>` |
| docsivi MDX components, code block features, slots | [references/docsivi-cheatsheet.md](references/docsivi-cheatsheet.md), then the docsivi documentation |
| The current project | `docs.config.ts`, `content/`, `custom/`, `package.json` (docsivi version, scripts) |

Read the installed docsivi version in `package.json`. The cheatsheet was verified against one version;
when the installed package disagrees, trust the installed package.

## Workflow

0. **Look at the project.** Is `docsivi` in `package.json`, and which version? Which scripts exist
   (`dev`, `build`, `typecheck`)? Is there a `docs.config.ts`? Which languages, versions and pages
   already exist? If docsivi is not set up, explain how to start (`bunx create-docsivi@latest`) and
   stop. Do not build a site skeleton by hand unless the user asks.
1. **Interview the user** ([references/interview.md](references/interview.md)). Mandatory, before any
   writing. Never assume languages, versions or audience.
2. **Propose the structure**: the tree of pages and `meta.json` files, one sentence per page. Get
   approval ([references/content-structure.md](references/content-structure.md)).
3. **Collect facts** from the code and TSDoc for the pages to write. Put gaps on a list of questions.
4. **Write the pages** in every language the user chose
   ([references/page-templates.md](references/page-templates.md),
   [references/translation.md](references/translation.md)). Update `meta.json` /
   `meta.<language>.json` and `docs.config.ts` (languages, versions, navigation, footer, and so on).
5. **Add blocks or plugins** when a page needs something docsivi does not have
   ([references/extending.md](references/extending.md)). Ask first.
6. **Verify** ([references/verification.md](references/verification.md)).
7. **Report** what was created and changed, what was verified, and which questions remain. Do not commit.

Blog posts are written only on request, with material from the author
([references/blog-posts.md](references/blog-posts.md)).

## Updating existing docs when the code changes

| Change in the user's code | Update |
| --- | --- |
| New exported function, class or type | A reference entry from its TSDoc; an example in a guide when it matters |
| Changed signature, behavior or default | Every page that describes it; a migration note if it breaks callers |
| Removed or renamed | The migration page (what to use instead, since which version); remove it from the reference |
| New CLI command, flag or environment variable | The CLI or settings page |
| New configuration option of the product | The configuration reference |
| New major version to support in parallel | A new documentation version (see content-structure.md) |

Also update `docs.config.ts` when a change needs it: a new language (`i18n`), a new version
(`versions`), a blog (`blog`), links in the header (`nav`), the footer (`footer`), Edit on GitHub
(`site.github`), the public address (`site.url`).

## Writing rules

- Address the reader as "you". Present tense. Imperative for instructions.
- No filler ("simply", "just", "obviously", "basically", "easy"), no marketing, no "we".
- One term per concept, used the same way everywhere.
- Examples are complete and **run**. Use names from the user's project, not `foo` / `bar`.
- State limits, errors and edge cases ("returns `null` when nothing matches", "throws when ...").
- Common path first, options later. Example first, details after.
- Internal links are written without a language: `/docs/<version>/page`, `/blog/<slug>`. The site adds
  the language.
- Do not write numbers that go stale quickly (counts of files, methods, tests).
- Pages in other languages follow [references/translation.md](references/translation.md).

## Before finishing

- [ ] Every fact is checked against the code, a test or a run.
- [ ] Pages exist in every chosen language, with identical code and links.
- [ ] New pages are listed in `meta.json` and in every `meta.<language>.json`.
- [ ] `docs.config.ts` matches the languages, versions and features in use.
- [ ] The build and the type check pass, and the check script is green.
- [ ] The new pages were opened in the browser, in each language, in the light and dark theme.
- [ ] Nothing was committed.

## Anti-patterns (stop and fix)

- Describing a signature in words instead of showing it and explaining behavior.
- A parameter description that repeats its name ("`id` - the id").
- Examples that were never run, or that show only the trivial case.
- Explaining internals in a guide, or writing a guide inside a reference.
- One page per function with no prose. Group related functions by topic.
- A page in one language whose code or links differ from the other languages.
- Guessing a language, a version name or a term instead of asking.
