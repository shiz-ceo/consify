# Changelog

All notable changes to `consify` are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0] - not released yet

The first version.

- **Docs:** MDX pages from `content/docs`, sidebar from folders and `meta.json`, table of contents, search (server endpoint or a static index), previous and next links, Edit on GitHub, `llms.txt`, generated social images, sitemap and `robots.txt`.
- **Languages and versions:** translations as sibling files, `i18n.fallback` for pages without a translation (`notice`, `show`, `hide`), several versions of the docs with a switcher and a deprecated banner.
- **Blog:** categories, tags, authors, search, numbered pages, RSS, social images, reading time; drafts and future posts are never compiled.
- **API reference** from an OpenAPI schema (Scalar), optional.
- **Customization:** theme tokens, plugins (remark, rehype, Shiki), custom MDX components, slots for the home page (`custom/home.tsx` or `content/home.mdx`), header and footer, `header.hideSearchOn`, a footer with columns and social icons.
- **Code and diagrams:** highlighted lines and diffs, tabs, type-checked `twoslash` blocks, KaTeX, Mermaid styled with the theme of the site.
- **Deployment:** a Node server or plain static files (`deploy.mode`), `deploy.basePath`.
- **Tooling:** the `consify` CLI (`dev`, `build`, `start`, `typegen`), the `create-consify` generator, and the `consify-docs` skill for Claude.
