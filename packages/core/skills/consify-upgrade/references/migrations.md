# Known migrations

No release so far has a breaking change, so there is nothing to migrate: 1.0.0 to 1.2.0 are
drop-in upgrades. Every release with a breaking change adds one section here, oldest first, in the
format below. Match `CHANGELOG.md` entries against the project directly (step 3 of the skill).

## Optional features (not migrations)

- **1.2.0: anchors and snippets.** Both are off by default and change nothing until the project
  turns them on. `docs({ anchors: true })` gives every heading an English id and a registry
  (`consify anchors add`, then `check`); `docs({ snippets: true })` makes `<Snippet id />` read
  shared code and text from `snippets/<version>/`. Offer them in the report as options, never apply
  them as part of the upgrade.

## Format of an entry

```md
## <version>: <short name of the change>

**Changed:** what the old shape was and what the new one is, in one or two sentences.

**Detect:** the exact signal in a project: a grep (`grep -n "^\s*oldKey:" docs.config.ts`), a
file or folder that exists, an import. Something that finds every occurrence, not a guess.

**Fix:** the mechanical rewrite, before and after. Name the command if one does it
(`consify lang add`, `consify skill sync`).

**Risk:** low (a pure rename), medium (files move: list every one in the report, delete nothing
before every move is confirmed), or manual review (more than one reasonable fix: say which
question the user has to answer).
```

## Adding an entry

When a release ships a breaking change, read its `CHANGELOG.md` entry and write its section here in
the same shape, so the next upgrade does not start from zero. One change per section; an entry
without a reliable **Detect** is not finished.
