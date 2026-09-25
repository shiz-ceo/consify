# create-consify

Creates a documentation site with [consify](https://github.com/shiz-ceo/consify).

```bash
bunx create-consify@latest my-docs
# or: npm create consify@latest my-docs
```

It asks for the name, the languages and the package manager, copies a starter, and installs the
dependencies. It also adds the `consify-docs` skill for Claude (`--no-skill` to skip it).

Options: `--name`, `--languages en,ru`, `--pm bun|npm|pnpm|yarn`, `--no-install`, `--no-skill`,
`--git`, `-y`. Run `create-consify --help` for details.

## License

MIT
