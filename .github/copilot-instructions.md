# Copilot Instructions

Read `AGENTS.md` at the repository root and follow it. It is the single source of truth for conventions in this repository; this file only adds rules specific to Copilot code review, which does not read `AGENTS.md`.

## Code review priorities

Prioritize correctness, regressions and security over style preferences. Style is already enforced by ESLint (`npm run lint`, zero warnings allowed).

Compatibility logic must match `CONTEXT.md`, `docs/adr/0004-three-axis-verdict-model.md` and `docs/adr/0005-single-runtime-engine.md`. Flag code that widens the current two-engine design instead of moving toward those ADRs.

## Do not flag

- Language or stdlib behavior claims without verifying against the official documentation for the exact version pinned in `package-lock.json`.
- Findings a human already dismissed in a previous review round of the same PR. Re-raising them adds noise without new information.
- `Alert title=` and `Space orientation=`. These are the current Ant Design v6 props; `message` and `direction` are deprecated.
- `src/routeTree.gen.ts`. The TanStack Router Vite plugin generates it; nobody edits it by hand.
