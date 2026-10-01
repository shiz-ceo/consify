---
name: consify
description: Entry point for anything about the documentation site of a project that uses consify — writing or updating docs, blog posts, API reference, translating, theming, upgrading, auditing docs against code, or asking what is possible. Routes to the skill that actually fits (consify-docs-authoring, consify-blog-authoring, consify-api-reference-authoring, consify-theme, consify-translate, consify-upgrade, consify-content-audit) and handles the parts that are not specific to one of those (the interview, extending the site, verification). Use this first for any documentation request; it says which other skill to keep using.
---

# consify

consify is a foundation for documentation sites: `docs.config.ts`, a `content/` folder and,
optionally, `custom/`. This skill is the map — it does not write pages itself for a feature that has
its own skill; it figures out what is being asked, checks what is actually installed, and either
does the cross-cutting work itself or hands off.

**Never edit `node_modules/@consify/*`.** Everything happens in the user's project. Never make facts
up: what is undocumented in the code is a question, not something to invent.

## First, always

Look at the project before doing anything:

- Is `consify` in `package.json`? Which version? If not, explain how to start
  (`bun create @consify`) and stop — do not hand-build a skeleton.
- Read `docs.config.ts`: which `features` are listed (`docs()`, `blog()`, `apiReference()`, a
  project's own from `custom/features/`), languages, versions.
- Check `.claude/skills/` for the feature-specific skills this project actually has. If a feature
  package is installed but its skill is missing (the dependencies changed since the last sync), tell
  the user to run `consify skill sync` before continuing — you may be missing that feature's
  conventions.

## Route the request

| The user wants to... | Do this |
| --- | --- |
| Write documentation from scratch for an existing project (no content yet, or a full rewrite) | Interview ([references/interview.md](references/interview.md)) → propose structure → hand the actual writing to **consify-docs-authoring** (or the section skill that fits) |
| Document one thing ("write docs for the payments module", "add a guide for X") | Read the code, sketch a short plan (pages + one line each) with **consify-docs-authoring**'s conventions, show it, get a "yes" before writing. If it would need a capability the project does not have yet (versions, `apiReference()`, a custom component) — stop and ask, do not silently work around it or silently add it — see [references/extending.md](references/extending.md) |
| Write a blog post | Hand off to **consify-blog-authoring** if installed; if there is no blog yet, ask whether to add one (`bun add @consify/blog`, `blog()` in `features`) before writing |
| Keep the API reference in sync with an OpenAPI schema | Hand off to **consify-api-reference-authoring** if installed |
| Change the look (colors, presets, a brand color, fonts, custom components) | Hand off to **consify-theme** |
| Translate something (a page, a post, the whole site) into another language | Hand off to **consify-translate** — it owns the glossary across requests, do not re-derive translation rules here |
| Move to a new consify version, or ask "what breaks if I upgrade" | Hand off to **consify-upgrade** |
| "Is anything in the docs out of date / stale?" | Hand off to **consify-content-audit** — only on explicit request, never on its own |
| Build a feature package (reused across projects or published, like `@consify/blog`) | Hand off to **consify-extension-engineering** |
| Add a component, a plugin, a header/footer, a front page, a section of this project (`custom/features/<name>.tsx`), a project skill | [references/extending.md](references/extending.md) — always ask before adding |
| "What can consify do?" / general questions about config | [references/cheatsheet.md](references/cheatsheet.md) |

A big ask ("document the whole project") touches several of the above in sequence: interview once,
then run the docs pass, then (only if the user actually wants it) suggest a launch blog post, then
hand off to **consify-translate**. Do not silently expand scope — confirm each phase.

## Verify, always, before reporting done

Run in order, stopping at the first failure (see [references/verification.md](references/verification.md) for what each one catches):

```bash
bun run build            # MDX/YAML errors, a front matter the feature's schema refuses: stops and names the file
bun run typecheck        # if the project has the script
bunx consify check --strict   # every address of every feature, front matter, translations, meta.json
consify lang status      # a quick table of what is translated per language
```

Then look at the changed pages with `bun run dev` before calling it done.

## Report, do not commit

Tell the user which pages were created or changed, what could not be checked and why, and any
assumption you made. Never commit — that is the user's call.
