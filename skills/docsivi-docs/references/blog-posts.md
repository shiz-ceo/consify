# Blog posts

Write a post **only when the user asks**. The **author provides the material**. Never invent content,
numbers, dates or quotes.

## Interview before a post

Ask in one batch, with a default for each:

1. **Topic and main idea** in one sentence. Who reads it.
2. **Type:** a release announcement, an explanation of a decision, a guide, a story.
3. **Key points:** three to seven things the author wants to say.
4. **Facts:** numbers, versions, dates, measurements. Use only what the author gives or what the
   code proves.
5. **Material:** ready code samples, screenshots, diagrams.
6. **Links:** related documentation pages and outside links.
7. **Author:** the id from `blog.authors` and the role. Add a new author to `docs.config.ts` if needed.
8. **Categories and tags:** ids from `blog.categories`; are new categories needed?
9. **Date and status:** a future date or `draft: true` keeps it unpublished.
10. **Languages** of the post (ask; do not assume).
11. **Cover:** an image exists, or make a simple one?
12. **Off limits:** plans, customers, numbers not to mention.
13. **Voice:** personal ("I", "we") or neutral.

Answers 1 to 3 are enough to propose an outline. Without the facts of question 4, write no claims
about numbers, dates or results; list what is missing in the report and ask.

## Set up the blog if it is not there

The `blog` block in `docs.config.ts` defines categories and authors. A post that names an unknown
category or author stops the build.

```ts title="docs.config.ts"
blog: {
  categories: [{ id: "releases", label: "Releases" }],
  authors: { ada: { name: "Ada Novak", role: "Maintainer" } },
},
```

## Files

- `content/blog/<slug>.mdx`, and `<slug>.<language>.mdx` for each other language.
- The slug is lowercase letters, digits and hyphens. It becomes the address.
- A cover in `public/blog/` (for example `/blog/<slug>.svg`).

## Front matter

```yaml
---
title: "The title"           # quote it if it contains ": "
description: "One or two sentences."
date: 2026-09-25             # a future date keeps the post unpublished
categories: [releases]       # ids from docs.config.ts
tags: [release]
authors: [ada]               # ids from docs.config.ts
cover: /blog/<slug>.svg
coverAlt: What the cover shows
draft: false
---
```

## Structure

A short introduction (what the post is about and for whom), then `##` headings (they feed the table
of contents), code with `title="..."` and highlighted lines, a table or a diagram for the main idea,
callouts for asides, and a `<CTA>` at the end that links to the documentation.

- **Release announcement:** what is new, what breaks and how to migrate, links to the docs pages.
- **Decision post:** the problem, the options, the choice, what did not work.
- **Guide:** the goal, the steps, the result.

Blog components (no imports): `Authors`, `Expand`, `PR`, `Benchmark`, `Figure`, `Embed`, `CTA`.

## Drafts

`draft: true` or a future date keeps a post out of the site, the search, the feed and the build.
Preview with `DOCSIVI_DRAFTS=1` and the dev command; never build for production with it.
