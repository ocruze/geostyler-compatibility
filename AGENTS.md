# AGENTS.md

This file provides guidance to coding agents when working with code in this repository. Claude Code reads it through `CLAUDE.md`.

## What this is

`geostyler-compatibility` is a React + Vite single-page app: a dashboard for checking compatibility between GeoStyler packages (style parsers, data parsers, UI components). It is `private` (not published to npm) and deploys to GitHub Pages. Stack: React 18, Vite 7, TypeScript 5.6, **Ant Design v6** (`antd` + `@ant-design/icons`), **TanStack Router** (file-based routing).

Sibling checkouts under the parent directory are `geostyler-cql-parser`, `geostyler-qgis-parser` and `geostyler-sld-parser`. They share no instruction file.

## Commands (npm)

- Dev server: `npm run dev` (Vite, http://localhost:5173)
- Build: `npm run build` (`tsc && vite build`)
- Preview built site: `npm run preview`
- Regenerate data: `npm run generate-data` (= `fetch-metadata` then `compute-compatibility`)
  - `npm run fetch-metadata` — `tsx scripts/fetch-metadata.ts`
  - `npm run compute-compatibility` — `tsx scripts/compute-compatibility.ts`
- Lint: `npm run lint` (ESLint 9 flat config — passes cleanly)
- Test: `npm test` (Vitest, one-shot) / `npm run test:watch`

Node is pinned via `.nvmrc` to `24.14.0`. Vitest covers `src/utils/semver.ts`, `src/utils/date.ts`, `src/api/queries.ts`, `src/engine/*` (against real records frozen in `src/engine/__fixtures__/versions.json`), and `scripts/fetch-metadata.ts` (`processNpmData`, `detectModuleSystem`, `detectEsmSupport`) against recorded registry responses in `scripts/__fixtures__/registry/`, plus `src/constants/repos.ts` (9 test files, 91 tests). No Storybook, no commitlint/semantic-release in this app.

## Gotchas (read before running)

- **`src/data/` is generated and gitignored.** `src/data/packages.json` and `src/data/compatibility-matrix.json` do not exist in a fresh clone. Run `npm run generate-data` (or the two scripts) before `dev`/`build`, or the app has no data. `fetch-metadata` writes `src/data/packages.json`; `compute-compatibility` reads that and writes `src/data/compatibility-matrix.json`.
- **`eslint.config.js` is a flat config** wiring `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`; it ignores `src/routeTree.gen.ts` and `src/data/**`, and disables `react-refresh/only-export-components` for `src/routes/**/*.tsx` (TanStack file-routes must export a non-component `Route` alongside the component).
- **`fetch-metadata` does NOT use `GITHUB_TOKEN`.** The script only fetches the npm registry (`registry.npmjs.org`); it reads no GitHub token and calls no GitHub API. It does honor `HTTPS_PROXY`/`HTTP_PROXY` (via undici `ProxyAgent`). The CI workflow still passes `secrets.GITHUB_TOKEN` to the step, but it is unused. `.env.example` still lists it as required — that file is stale too but out of scope here. Don't add token-fetch logic assuming it's wired up — it isn't.
- **AntD v6 renamed some props vs. v4/v5 muscle memory**: `Alert` uses `title` (not `message`), `Space` uses `orientation` (not `direction`) — both confirmed current in the installed `antd@6.3.1` types (`message`/`direction` are `@deprecated`). Don't "fix" existing `title=`/`orientation=` usages in this codebase.
- **Peer-dependency conflicts are a first-class incompatibility reason**, checked bidirectionally in both the build script (`scripts/compute-compatibility.ts`) and the runtime check (`checkVersionCompatibility` in `src/api/queries.ts`) via `semver.satisfies` — not just a geostyler-style-range/ESM check.

## Architecture

- **Redesign in progress**: ADR-0004 (three-axis verdicts) and ADR-0005 (single runtime engine) are accepted. `src/engine/` is the new runtime engine: `evaluatePair` (three axes to one of seven verdicts), `buildVersionSet` (anchors newest-first, declared dependencies followed, a Risk pair accepted when a third chosen version declares both), `buildLatestReleasesGrid`, `verdictSentence`. `src/components/Verdict.tsx` is the one verdict component (`VerdictTag`, `VerdictCell`, `VerdictDetail`). The legacy code below still has the old engine, a binary `compatible` flag and an ESM axis. Since #30 the dataset carries the three-axis inputs. New code reads `coreRanges`, `declaredDependencies` and `moduleSystem`, not `geostylerStyleRange` or `esmSupport`. Before touching compatibility logic, read `docs/adr/0004-three-axis-verdict-model.md`, `docs/adr/0005-single-runtime-engine.md` and `CONTEXT.md`. Move toward them; do not extend the two-engine design.
- **Entry**: `src/main.tsx` — wraps the app in antd `ConfigProvider` (theme: `colorPrimary '#1677ff'`, `theme.defaultAlgorithm`, `enUS` locale) + an AntD `<App>` wrapper (enables `App.useApp()` context for message/modal/notification) + TanStack `RouterProvider`. Router has `basepath: import.meta.env.BASE_URL ?? '/'`, `defaultPreload: 'intent'`, `defaultNotFoundComponent`, and `defaultErrorComponent`.
- **Routing**: file-based routes in `src/routes/` (`__root.tsx`, `index.tsx`, `overview.tsx`, `compare.tsx`, `docs.tsx`, `package.$name.tsx`). `index.tsx` is the stack builder (`src/components/StackBuilder.tsx`): the stack is a comma-separated `stack` search parameter, an empty stack shows the latest releases grid (`src/components/LatestReleasesGrid.tsx`), a non-empty one shows the version set from `buildVersionSet` (`src/components/VersionSetView.tsx`); `overview.tsx` and `compare.tsx` are legacy pages slated for removal (#38). `src/routeTree.gen.ts` is **generated** by `@tanstack/router-plugin` (Vite) — do not hand-edit.
- **Data access**: `src/api/queries.ts`. **TanStack Query is not used** — the `use*` hooks (`usePackages`, `useCompatibilityMatrix`, `usePackage`, `useCompatibilityCheck`) are synchronous wrappers over statically-imported `@/data/*.json`, returning `{ data, isLoading: false, error: null }`. Adding real async/caching would mean introducing `@tanstack/react-query` (not currently a dep). The same file exports `findRecommendedSet` (searches a version set, newest `geostyler-style` anchor first) and `getVersionCompatibilityMatrix` (feeds the Compare page's version grid).
- **Core compatibility logic**: `checkVersionCompatibility(v1, v2)` in `src/api/queries.ts` intersects each version's `geostylerStyleRange` via `intersectRanges` from `src/utils/semver.ts` (real `semver.validRange`/`minVersion` math — ranges are ANDed by string concatenation, which is exact for the simple caret/tilde/comparator ranges this dataset uses; revisit if a `||` range is ever introduced), marks incompatible on empty intersection, checks `peerDependencies` bidirectionally (hard incompatibility), and warns (not errors) on ESM/CJS (`esmSupport`) mismatch. The tracked-repo list (twelve packages, no `geostyler-cql-parser`), `REPO_TO_NPM`, `TRACKED_PACKAGES` and `CORE_PACKAGES` live in `src/constants/repos.ts`; shared types in `src/types/compatibility.ts`. `intersectRanges` is the shared core used by both the build script and the runtime check. ESM support is detected from real npm metadata (`detectEsmSupport` in `scripts/fetch-metadata.ts`, checking `type`/`module`/`exports.import`) — not version-number guessing.
- **The Compare page's version matrix (`compare.tsx`) defaults to a "problems only" view** (only rows/columns with a real incompatibility or warning). The full 20×20 grid is collapsed by default. With the full grid expanded or "problems only" off, the a11y tree is large; prefer `browser_take_screenshot` over `browser_snapshot` there.
- **Data pipeline** (build-time, Node via `tsx`): `scripts/fetch-metadata.ts` reads npm registry metadata for the tracked packages and emits `src/data/packages.json`, tracking per-package fetch failures and setting `process.exitCode = 1` if any occur; `scripts/compute-compatibility.ts` computes the pairwise (+ some UI/parser triplet) compatibility matrix into `src/data/compatibility-matrix.json`. The `packages.json` file is `{ generatedAt, packages }`. Each version record carries:
  - `coreRanges`, keyed by core package (`geostyler-style`, `geostyler-data`), each `{ source: 'declared', range }`, `{ source: 'transitive', range, origin: { name, version } }` or `{ source: 'none' }`. `resolveTransitiveCoreRanges` in `scripts/fetch-metadata.ts` fills the transitive ones once every package is in memory. It walks declared dependencies on tracked packages by name, takes the newest version satisfying each range, and repeats until it finds a declared range. The legacy `geostylerStyleRange` only mirrors declared ranges.
  - `declaredDependencies`: dependencies on tracked packages only.
  - `peerDependencies`, `isPrerelease`, and `moduleSystem` (`esm`, `cjs` or `types-only`).
  - `geostylerStyleRange` and `esmSupport`: legacy fields the old engine still reads. `geostylerStyleRange` is derived from `coreRanges`. The footer in `src/routes/__root.tsx` shows `generatedAt` as a UTC date.

## Build & config notes

- **Vite base path is hardcoded** `base: "/geostyler-compatibility/"` in `vite.config.ts` (for the GitHub Pages subpath); the router picks this up via `import.meta.env.BASE_URL`. Plugins: `tanstackRouter({ target: 'react', autoCodeSplitting: true })` then `react()`. Path alias `@` → `./src` (mirrors the tsconfig `@/*` alias).
- `tsconfig.json`: bundler resolution, `target ES2020`, `strict` + `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`, `noEmit`. Path alias `@/* → ./src/*`. `include: ["src", "scripts"]`.
- **Deploy**: `.github/workflows/build-deploy.yml` — triggers on push to `main`, daily cron (midnight UTC), or manual dispatch. Steps: `npm ci` → `fetch-metadata` → `compute-compatibility` → `build` → `cp dist/index.html dist/404.html` (GitHub Pages serves `404.html` for unknown paths, so deep links load the app) → upload `./dist` as a Pages artifact → `actions/deploy-pages`. Uses Node from `.nvmrc`.
- `.env` is NOT required for local data generation — `fetch-metadata.ts` reads no token. `.env.example` still exists and lists `GITHUB_TOKEN` as required, which is stale; keep secrets out of git regardless (`.env` is gitignored).
- **Dependency updates are Renovate-managed** (`renovate.json`) — most of the commit history is automated `chore(deps)` bumps rather than manual upgrades.

## Git

- Commit messages: simple English, conventional-commit style (`feat:`, `fix:`, `chore:`...), one line, no body unless truly necessary.
- Small atomic commits: one logical concern per commit.
- Never commit on `main`: create a branch first. Branch names are short, in conventional-commit type/scope style, with the issue number when relevant (`feat/charts`, `fix/compare-matrix-12`).
- Validate commit messages, PR descriptions and comments by a human if necessary.
- PR titles: conventional-commit style, issue number when relevant. PR descriptions in English: concise, simple wording, no AI-sounding or corporate jargon. Don't repeat what the linked issue already says. Structure: `Closes #N`, a short "Changes" bullet list, "Validation" when relevant, and an explicit call-out for any deliberate behavior change.

## Comments

- Comment only where the code is not self-explanatory: one line max, plain English stating the intent, no jargon. No descriptive docblocks that paraphrase a component or attribute name.
- Avoid "chrome"/"shell" UI jargon: name the thing (header, footer, navigation, breadcrumb).
- When a change alters a documented contract (laziness, nullability, thrown exceptions), update the docblock/doc in the same change.

## Writing style

Applies to all prose: chat responses, PR descriptions, commit bodies, comments, docs.

- One idea per sentence. Target under 25 words per sentence.
- Active voice. Name the actor ("the hook rejects the commit", not "the commit is rejected").
- Use concrete verbs. Banned words: leverage, robust, seamless(ly), streamline, comprehensive, powerful, simply, easily, crucial, delve.
- No unmeasurable adjectives. "Fast" needs a number or a comparison, or delete it.
- One term per concept. Do not rotate synonyms for variety.
- Define a term at first use if it is not in the codebase or a linked doc.
- Hedging is allowed only when it carries information: "might" must mean real uncertainty, never politeness.
- No summary paragraphs that restate what was just said. End when done.
- If a sentence survives with nothing lost after deletion, delete it.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues on `ocruze/geostyler-compatibility`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` glossary and `docs/adr/` at the repo root. See `docs/agents/domain.md`. Use the seven verdict names from `CONTEXT.md` (Conflict, Risk, Duplicate, Compatible, Shipped together, Independent, Unknown). The code still says `compatible`/`incompatible` until ADR-0004 lands.
