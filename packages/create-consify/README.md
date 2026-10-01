# @consify/create

Creates a documentation site with [consify](https://github.com/shiz-ceo/consify).

```bash
bun create @consify my-docs
# or: npm create @consify my-docs
```

`consify`'s packages are published to GitHub Packages, not the default npm registry — add an
`.npmrc` with `@consify:registry=https://npm.pkg.github.com` and a `read:packages` token before
installing (the generator writes the `.npmrc` for the new project for you, but installing
`@consify/create` itself still needs your own token set up first).

It asks for the name, the languages and the package manager, copies a starter (the pages go to
`content/<main language>/docs`; for every language other than en and ru it also writes an empty
interface pack in `custom/locales`), and installs the dependencies. The config of the new project has `docs()` from the `@consify/docs` package in
`features`. It also syncs the skills for Claude (`--no-skill` to skip it).

Options: `--name`, `--languages en,ru`, `--pm bun|npm|pnpm|yarn`, `--no-install`, `--no-skill`,
`--git`, `-y`. Run `create-consify --help` for details.

## License

MIT
