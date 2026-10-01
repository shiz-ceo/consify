# consify cheatsheet

A short map of what consify can do. It does **not** replace the schema of the installed package
(`node_modules/@consify/core/src/config/schema.ts`, or its published `.d.ts`). When they disagree,
the installed package is right. `consify --help` lists the commands. Do not invent a docs link: use
the site this project was made from, or ask the user.

## The project

```
my-docs/
├─ docs.config.ts             all settings (defineConfig from "@consify/core")
├─ vite.config.ts             plugins: [consify(config)]
├─ react-router.config.ts     export default defineRouterConfig(config)
├─ content/
│  └─ <language>/             en/, ru/, …: one folder per language, the main one too
│     ├─ home.mdx             the front page (optional)
│     ├─ docs/<version>/      pages of the docs
│     ├─ blog/                posts
│     └─ <feature>/           content of any other feature
├─ custom/
│  ├─ components/*.tsx        Foo.tsx is <Foo /> in every .mdx file
│  ├─ features/*.tsx          your own sections, one file each (defineFeature)
│  ├─ plugins/                remark / rehype / Shiki plugins (listed in mdx.plugins)
│  ├─ header.tsx, footer.tsx  replace those parts of the site
│  ├─ locales/<lang>.ts       interface strings
│  ├─ skills/<name>/SKILL.md  skills of the project (consify skill sync)
│  └─ theme.css               styles, loaded after the core theme
├─ public/                    favicon, images
├─ .claude/skills/            written by consify skill sync
├─ .consify/  build/  .react-router/   generated: do not edit, do not commit
```

Commands come from the project's `package.json` scripts, usually `dev`, `build`, `start`,
`typecheck`.

## Configuration (top-level keys)

`site`, `i18n`, `theme`, `head`, `banner`, `header`, `footer`, `slots`, `features`, `mdx`,
`deploy`. Unknown keys are errors: a typo stops the build with a message that names it.

```ts title="docs.config.ts"
import { apiReference } from "@consify/api-reference";
import { blog } from "@consify/blog";
import { defineConfig } from "@consify/core";
import { docs } from "@consify/docs";
import { status } from "./custom/features/status.tsx";

export default defineConfig({
  site: { name: "Acme", url: "https://docs.acme.dev", github: { repo: "acme/acme" } },
  i18n: { defaultLanguage: "en", languages: ["en", "ru"] },
  features: [docs(), blog(), apiReference({ input: "./openapi.json" }), status],
  mdx: { math: true, twoslash: true, plugins: [] },
});
```

| Need | Key |
| --- | --- |
| Name, address, GitHub repository, logo, favicon | `site` (`name`, `description`, `url`, `logo`, `favicon`, `github: { repo, branch }`) |
| Languages, their names, a page without a translation | `i18n` (`defaultLanguage`, `languages`, `labels`, `messages`, `fallback`: `notice` / `show` / `hide`) |
| Interface strings for a language | `consify locale <language>` writes `custom/locales/<language>.ts`; English and Russian are built in; one string: `i18n.messages` |
| Sections of the site | `features: [...]`, in order |
| The docs | `docs({ id, title, versions, toc, breadcrumbs, pagination, llmsTxt, og, editOnGithub })` from `@consify/docs` — see **consify-docs-authoring** |
| A blog | `blog({ id, title, description, perPage, categories, authors, share, rss })` from `@consify/blog` — see **consify-blog-authoring** |
| API reference from OpenAPI | `apiReference({ input, title, id })` from `@consify/api-reference` — see **consify-api-reference-authoring** |
| A second docs section or blog | another call with its own `id`: `docs({ id: "guides", title: "Guides" })` → `/{lang}/guides`, `content/<lang>/guides/` |
| Your own section | `defineFeature` in `custom/features/<name>.tsx`, imported and listed in `features` |
| Math, twoslash, MDX components, plugins | `mdx` (`math`, `twoslash`, `components`, `plugins`) |
| Colors, presets, brand, fonts | `theme` — see **consify-theme** |
| Tags and scripts in every `<head>` | `head` (`meta`, `links`, `scripts`), or `head: (lang) => ({...})` |
| A closable announcement | `banner` (`text`, `href`, `id`, `variant`: `info` or `warning`) |
| Header links and menus | `header.links` (ids from `consify links`, `{ title, url }`, `{ title, items }`); without it the header lists every feature with a title |
| Footer | `footer` (`description`, `columns[].links`, `social`, `legal`), or `false` |
| Replace the header or footer | `custom/header.tsx`, `custom/footer.tsx`, or `slots: { header, headerEnd, footer }` |
| Server or static, sub path, hosting | `deploy` (`mode`, `basePath`) and `consify deploy`; `consify doctor` is safe any time |

Search is on for every feature with content; there is no switch.

## The front page

`content/<language>/home.mdx`, with `<Hero title description actions />` and `<Features items />`.
Without it `/{lang}` redirects to the first feature with a title. A feature with `path: ""`
replaces it with a React page.

## Pages

An `.mdx` file with front matter: `title` (required), `description`, `icon` (a Lucide icon name),
`full`. A value that contains `: ` or ` #` must be in double quotes.

Folders are sections. `meta.json` in a folder sets `title`, `icon` and `pages` (order); `"---Text---"`
draws a separator, `"..."` stands for every page not listed, `"root": "version"` marks a version root.

## MDX components (no imports needed)

`Callout` (`info`, `warn`, `error`, `success`, `idea`), `Tabs` / `Tab`, `Steps` / `Step`, `Cards` /
`Card`, `Accordions` / `Accordion`, `Files` / `Folder` / `File`, `TypeTable`, `Banner`, `Badge`,
`Video`, `Mermaid`. Front page: `Hero`, `Features`. Blog (with `blog()`): `Authors`, `Expand`, `PR`,
`Benchmark`, `Figure`, `Embed`, `CTA`. `custom/components/*.tsx` and `mdx.components` add more and
replace a built-in one with the same name.

## Code blocks

````text
```ts title="server.ts" lineNumbers {2,4-5}
```
````

- `title="..."` file name, `lineNumbers`, `{2,4-5}` highlighted lines, `// [!code highlight]`.
- Diff: `// [!code --]` and `// [!code ++]`.
- Tabs: blocks with `tab="Name"` become tabs.
- `ts twoslash`: the block is compiled and identifiers get type hovers (`// ^?` prints a type,
  `// @errors: 2322` expects an error, `// ---cut---` hides the setup above).
- `mermaid` blocks draw diagrams. `$..$` and `$$..$$` are math.

## Languages and versions

- A translation has the same path in the folder of its language: `content/en/docs/v1/guide.mdx` →
  `content/ru/docs/v1/guide.mdx`; `meta.json` too. `consify lang add <language> [--copy]` prepares
  a language, `consify lang status [language] [--missing]` shows what is left.
- A page without a translation is shown in the default language (`i18n.fallback`: `notice` adds a
  note and an `EN` mark, `show` shows it as is, `hide` removes it from that language). List every
  page in the `meta.json` of the language; a forgotten one is appended with a warning.
- A version is a folder under `content/<language>/docs` with `"root": "version"` in its
  `meta.json`, listed in `versions.list` of `docs()`. Statuses: `latest`, `stable`, `deprecated`
  (a banner that points to the latest).

## Blog

Posts are `content/<language>/blog/<slug>.mdx`. Categories and authors come from the options of
`blog()`; an unknown one stops the build with the file named. A draft or a post dated in the future
is not published; `CONSIFY_DRAFTS=1` shows them while writing. RSS at `/{lang}/blog/rss.xml`.

## Links

Write internal links without a language: `/docs/<version>/page`, `/blog/<slug>`. The site adds the
language. Relative links to files (`./other.mdx`) also work.

## Commands

| Command | Does |
| --- | --- |
| `consify check [--strict]` | Every address of every feature, front matter, translations (same code blocks, links, headings), `meta.json` |
| `consify lang add <lang> [--copy]`, `consify lang status [lang] [--missing]` | Languages |
| `consify locale [lang]` | Interface strings file for a language |
| `consify links [lang]` | Link ids the features offer, for `header.links` / `footer.columns` |
| `consify skill sync [--force]`, `consify skill list` | Skills into `.claude/skills/` |
| `consify add <item>` | A registry item: a component, plugin, theme, skill (`custom/skills/<name>/`); a `feature` item prints the line for `features` |
| `consify doctor`, `consify deploy` | Health check, hosting files |

## Skills

`consify skill sync` copies into `.claude/skills/` the `skills/<name>/SKILL.md` of every
`@consify/*` (and `consify-*`) package the project depends on — `@consify/core` brings this one,
`consify-theme`, `consify-translate`, `consify-upgrade`, `consify-content-audit`,
`consify-extension-engineering` — and the project's own `custom/skills/<name>/SKILL.md`, which win
by name. `consify skill list` previews it. It never replaces a folder it did not create without
`--force`. Run it again after adding or updating a consify package.
