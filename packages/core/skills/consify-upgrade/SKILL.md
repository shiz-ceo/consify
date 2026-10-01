---
name: consify-upgrade
description: Move a project to a newer consify version — find which breaking changes between the installed and target version actually touch this project, migrate what can be migrated mechanically, and report what needs a manual look. Use when asked to upgrade consify, update @consify/* packages, or "what breaks if I update".
---

# consify-upgrade

consify prints no deprecation warnings: a removed or renamed option simply fails validation (an
unknown config key stops the build with its name), and a changed shape may not fail at all. The
changelog is the source; the project is where you check it. Some changes are mechanical (a renamed
key, a moved import), some need a human decision.

Never silently rewrite something you are not sure about. When a change is ambiguous (the project did
something unusual with the old shape), stop and ask instead of guessing.

## Workflow

1. **Find the versions.** The installed one: `consify --version` (every `@consify/*` package) or read
   `package.json`. The target: the one the user asked for, or the latest published — `consify doctor`
   confirms every `@consify/*` package agrees before you start.
2. **Read the changelog between them.** `node_modules/@consify/core/CHANGELOG.md` — every package
   ships the same file. Read every entry from just after the installed version up to the target, in
   order (oldest first).
3. **Match each entry against this project.** [references/migrations.md](references/migrations.md)
   lists the known migrations of released versions, each with what to grep for and how to fix it —
   check it first. For an entry it does not cover, find the entry's own signal (a config key it says
   was renamed or removed, a file layout it says changed) and grep the actual project; do not assume
   it does or does not apply.
4. **Apply what is safe to apply mechanically** (a renamed config key, a moved import) directly.
   **Flag what needs a decision** (a removed feature with no direct equivalent, a structural change
   that depends on how the project used the old shape) instead of guessing at the right answer.
5. **Bump the packages:**
   ```bash
   bun update @consify/core @consify/cli @consify/docs @consify/blog @consify/api-reference
   ```
   (only the ones actually installed).
6. **Verify.**
   ```bash
   consify doctor
   bun run build
   bun run typecheck
   bunx consify check
   ```
   An "unknown key" error names an old key you missed — grep for it again.

Then run `consify skill sync`: the skills of the new versions replace the old ones.

## Report

Three lists, always:

- **Migrated automatically** — what changed and where (file:line where it matters).
- **Needs a manual look** — a breaking change that applies here but has more than one reasonable fix,
  with the specific question to answer.
- **Checked, does not apply** — so the user knows it was considered, not skipped.

Never commit. Say the upgrade is ready for review.
