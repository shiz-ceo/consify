# Known migrations

consify has not been released yet (0.1.0 was never published), so there are no migrations to
apply. The catalog starts with the first release: from then on, every release with a breaking
change adds one section here, oldest first, in the format below. Until then, match
`CHANGELOG.md` entries against the project directly (step 3 of the skill).

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
