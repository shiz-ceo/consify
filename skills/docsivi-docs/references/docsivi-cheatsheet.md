# docsivi cheatsheet

A short map of what docsivi can do. It does **not** replace the schema of the installed package
(`node_modules/docsivi/src/config/schema.ts`). When they disagree, the installed package is right.
Details: the docsivi documentation at `<docsivi docs URL>`.

## The project

```
my-docs/
├─ docs.config.ts            all settings (defineConfig from "docsivi")
├─ vite.config.ts            plugins: [docsivi(config)]
├─ react-router.config.ts    export default defineRouterConfig(config)
├─ content/
│  ├─ docs/<version>/        pages of the documentation
│  ├─ blog/                  posts
│  └─ home.mdx               optional home page in MDX (home.<language>.mdx)
├─ custom/
│  ├─ components/            Foo.tsx becomes <Foo /> in every .mdx file
│  ├─ plugins/               remark / rehype / Shiki plugins
│  ├─ home.tsx, header.tsx, footer.tsx    optional slots
│  └─ theme.css              optional styles, loaded after the core theme
├─ public/                   favicon, images
├─ .docsivi/  build/  .react-router/       generated: do not edit, do not commit
```

Commands come from the project's `package.json` scripts, usually `dev`, `build`, `start`, `typecheck`.

## Configuration (top-level keys)

`site`, `i18n`, `versions`, `features`, `theme`, `twoslash`, `home`, `nav`, `header`, `footer`,
`slots`, `blog`, `openapi`, `deploy`, `components`, `plugins`. Types and defaults are in the schema.
Unknown keys are errors, so a typo in a key stops the build with a message that names it.

| Need | Key |
| --- | --- |
| Name, address, GitHub repository, favicon | `site` (`name`, `url`, `github.repo`, `favicon`) |
| Languages and their names, what a page without a translation does | `i18n` (`defaultLanguage`, `languages`, `labels`, `messages`, `fallback`) |
| Versions of the docs | `versions` (`list[].id`, `label`, `status`; `default`) |
| Switch built-in behavior | `features` (`search`, `toc`, `breadcrumbs`, `pagination`, `llmsTxt`, `og`, `editOnGithub`, `math`, `twoslash`) |
| Colors, radius, fonts | `theme` |
| Extra header links | `nav` |
| Footer | `footer` (`description`, `columns`, `social`, `legal`), or `false` |
| A blog | `blog` (`categories`, `authors`, `perPage`, `share`, `rss`) |
| API reference from OpenAPI | `openapi` (`input`, `title`) |
| Server or static, sub path | `deploy` (`mode`, `basePath`) |
| Your MDX components, plugins | `components`, `plugins` |
| Replace home, header, footer | `slots` (or the files in `custom/`) |

## Pages

An `.mdx` file with front matter: `title` (required), `description`, `icon` (a Lucide icon name),
`full`. A value that contains `: ` or ` #` must be in double quotes.

Folders are sections. `meta.json` in a folder sets `title`, `icon` and `pages` (order); `"---Text---"`
draws a separator, `"..."` stands for every page not listed, `"root": "version"` marks a version root.

## MDX components (no imports needed)

`Callout` (`info`, `warn`, `error`, `success`, `idea`), `Tabs` / `Tab`, `Steps` / `Step`, `Cards` /
`Card`, `Accordions` / `Accordion`, `Files` / `Folder` / `File`, `TypeTable`, `Banner`, `Badge`,
`Video`, `Mermaid`. Blog: `Authors`, `Expand`, `PR`, `Benchmark`, `Figure`, `Embed`, `CTA`. Home page:
`Hero`, `Features`. Your own components from `custom/components` are added to the list and replace a
built-in one with the same name.

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

- A translation is a sibling file: `guide.mdx` and `guide.ru.mdx`; `meta.json` and `meta.ru.json`.
  A page without a translation is shown in the default language (`i18n.fallback`: `notice` adds a
  note and an `EN` mark, `show` shows it as is, `hide` removes it from that language). List every
  page in `meta.<language>.json`; a forgotten one is appended with a warning.
- A version is a folder under `content/docs` with `"root": "version"` in its `meta.json`, listed in
  `versions.list`. Statuses: `latest`, `stable`, `deprecated` (shows a banner that points to the latest).

## Blog

Posts are `content/blog/<slug>.mdx` (translations `<slug>.<language>.mdx`). Categories and authors
come from the `blog` block. A draft or a post dated in the future is not published (it is not even
compiled). `DOCSIVI_DRAFTS=1` includes them while writing. RSS at `/{lang}/blog/rss.xml`.

## Links

Write internal links without a language: `/docs/<version>/page`, `/blog/<slug>`. The site adds the
language. Relative links to files (`./other.mdx`) also work.
