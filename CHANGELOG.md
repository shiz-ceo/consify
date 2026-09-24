# Changelog

All notable changes to `docsivi` are documented here. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [Unreleased]

- Monorepo skeleton (Bun workspaces): `packages/core`, `apps/starter`, `apps/demo`.
- **Breaking (branch `feature/react-router`):** Next.js is replaced by React Router (Vite). A project is now `docs.config.ts` + `vite.config.ts` + `react-router.config.ts`; routes are generated into `.docsivi/`. New `docsivi` CLI (`dev`, `build`, `start`, `typegen`).
