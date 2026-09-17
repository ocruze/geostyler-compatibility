# AGENTS.md

This file provides guidance to coding agents when working with code in this repository. Claude Code reads it through `CLAUDE.md`.

## What this is

`geostyler-compatibility` is a React + Vite single-page app: a dashboard for checking compatibility between GeoStyler packages (style parsers, data parsers, UI components). It is `private` (not published to npm) and deploys to GitHub Pages. Stack: React 18, Vite 7, TypeScript 5.6, **Ant Design v6** (`antd` + `@ant-design/icons`), **TanStack Router** (file-based routing).

Sibling checkouts under the parent directory are `geostyler-cql-parser`, `geostyler-qgis-parser` and `geostyler-sld-parser`. They share no instruction file.

## Commands (npm)

- Dev server: `npm run dev` (Vite, http://localhost:5173)
- Build: `npm run build` (`tsc && vite build`)
- Preview built site: `npm run preview`
- Regenerate data: `npm run fetch-metadata` (`tsx scripts/fetch-metadata.ts`)
- Lint: `npm run lint` (ESLint 9 flat config — passes cleanly)
- Test: `npm test` (Vitest, one-shot) / `npm run test:watch`

Node is pinned via `.nvmrc` to `24.14.0`. Vitest covers `src/utils/semver.ts`, `src/utils/date.ts`, `src/utils/stackSearch.ts`, `src/engine/*` (against real records frozen in `src/engine/__fixtures__/versions.json`), and `scripts/fetch-metadata.ts` (`processNpmData`, `resolveTransitiveCoreRanges`, `detectModuleSystem`) against recorded registry responses in `scripts/__fixtures__/registry/`, plus `src/constants/repos.ts` (11 test files, 106 tests). No component tests: routes call only the engine. No Storybook, no commitlint/semantic-release in this app.

## Gotchas (read before running)

- **`src/data/` is generated and gitignored.** `src/data/packages.json` does not exist in a fresh clone. Run `npm run fetch-metadata` before `dev`/`build`, or the app has no data. It is the only data file; there is no precomputed matrix (ADR-0005).
- **`eslint.config.js` is a flat config** wiring `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`; it ignores `src/routeTree.gen.ts` and `src/data/**`, and disables `react-refresh/only-export-components` for `src/routes/**/*.tsx` (TanStack file-routes must export a non-component `Route` alongside the component).
- **`fetch-metadata` does NOT use `GITHUB_TOKEN`.** The script only fetches the npm registry (`registry.npmjs.org`); it reads no GitHub token and calls no GitHub API. It does honor `HTTPS_PROXY`/`HTTP_PROXY` (via undici `ProxyAgent`). Neither the CI workflow nor any `.env` file passes a token. Don't add token-fetch logic assuming it's wired up — it isn't.
- **AntD v6 renamed some props vs. v4/v5 muscle memory**: `Alert` uses `title` (not `message`), `Space` uses `orientation` (not `direction`) — both confirmed current in the installed `antd@6.3.1` types (`message`/`direction` are `@deprecated`). Don't "fix" existing `title=`/`orientation=` usages in this codebase.
- **Shared peers are one of the three axes.** `evaluatePair` intersects every peer both versions declare (`ol`, `react`, `d3`). An empty intersection is the only Conflict verdict. ESM/CJS is not an axis; `moduleSystem` is a display fact on the package page.

## Architecture

- **One engine**: ADR-0004 (three-axis verdicts) and ADR-0005 (single runtime engine) govern all compatibility logic, and `src/engine/` is the only place it lives: `evaluatePair` (three axes to one of seven verdicts), `buildVersionSet` (anchors newest-first, declared dependencies followed, a Risk pair accepted when a third chosen version declares both, pins kept, the bottleneck as the package whose removal moves the anchor furthest forward, and on failure the failing pairs, the pin to relax and a partial set), `buildLatestReleasesGrid`, `buildPairMatrix` (newest 20 stable each side unless expanded), `verdictSentence`. `src/components/Verdict.tsx` is the one verdict component (`VerdictTag`, `VerdictCell`, `VerdictDetail`). The build step precomputes nothing but transitive core ranges. Before touching compatibility logic, read `docs/adr/0004-three-axis-verdict-model.md`, `docs/adr/0005-single-runtime-engine.md` and `CONTEXT.md`. Do not add a second engine or a binary `compatible` flag.
- **Header** (`src/routes/__root.tsx`): title links to the stack builder; items are "Check compatibility" and "Docs" plus the prerelease toggle.
- **Entry**: `src/main.tsx` — wraps the app in antd `ConfigProvider` (theme: `colorPrimary '#1677ff'`, `theme.defaultAlgorithm`, `enUS` locale) + an AntD `<App>` wrapper (enables `App.useApp()` context for message/modal/notification) + TanStack `RouterProvider`. Router has `basepath: import.meta.env.BASE_URL ?? '/'`, `defaultPreload: 'intent'`, `defaultNotFoundComponent`, and `defaultErrorComponent`.
- **Routing**: file-based routes in `src/routes/` (`__root.tsx`, `index.tsx`, `docs.tsx`, `package.$name.tsx`). Any other path, including the former `/compare` and `/overview`, renders the not-found page. `index.tsx` is the stack builder (`src/components/StackBuilder.tsx`): the stack is a comma-separated `stack` search parameter and pins a comma-separated `pin` parameter of `name@version` entries, an empty stack shows the latest releases grid (`src/components/LatestReleasesGrid.tsx`), a non-empty one shows the version set from `buildVersionSet` (`src/components/VersionSetView.tsx`) with the install command (`src/components/InstallLine.tsx`). The prerelease toggle is a browser preference (`localStorage`, context and hook in `src/hooks/usePrereleases.ts`, provider and switch in `src/components/PrereleaseToggle.tsx`), never URL state. `package.$name.tsx` shows header facts, the pair matrix (`src/components/PairMatrix.tsx`, partner in the `with` search parameter) and the version history with core range sources; it carries the `stack` and `pin` parameters so "Add to stack" returns to the same stack builder state (`src/utils/stackSearch.ts`). `src/routeTree.gen.ts` is **generated** by `@tanstack/router-plugin` (Vite) — do not hand-edit.
- **Data access**: `src/api/queries.ts`. **TanStack Query is not used** — `usePackages` is a synchronous wrapper over the statically-imported `@/data/packages.json`, returning `{ data, isLoading: false, error: null }`. Adding real async/caching would mean introducing `@tanstack/react-query` (not currently a dep). The same file exports `datasetGeneratedAt`.
- **Semver helpers** in `src/utils/semver.ts`: `intersectRanges` (real `semver.validRange`/`minVersion` math — ranges are ANDed by string concatenation, which is exact for the simple caret/tilde/comparator ranges this dataset uses; revisit if a `||` range is ever introduced), `satisfies`, `compareVersions`, `formatRangeForDisplay`. The tracked-repo list (twelve packages, no `geostyler-cql-parser`), `REPO_TO_NPM`, `TRACKED_PACKAGES` and `CORE_PACKAGES` live in `src/constants/repos.ts`; shared types in `src/types/compatibility.ts`.
- **Data pipeline** (build-time, Node via `tsx`): `scripts/fetch-metadata.ts` reads npm registry metadata for the tracked packages and emits `src/data/packages.json`, tracking per-package fetch failures and setting `process.exitCode = 1` if any occur. It fetches and trims; it computes no verdict. The file is `{ generatedAt, packages }`; the footer in `src/routes/__root.tsx` shows `generatedAt` as a UTC date. Each version record carries `name`, `version`, `category`, `publishDate`, `isPrerelease`, `moduleSystem`, `peerDependencies`, `declaredDependencies` and `coreRanges`. `detectModuleSystem` reads `esm`, `cjs` or `types-only` from the version's own package metadata. `declaredDependencies` keeps dependencies on tracked packages only.
  - `coreRanges` is keyed by core package (`geostyler-style`, `geostyler-data`), each `{ source: 'declared', range }`, `{ source: 'transitive', range, origin: { name, version } }` or `{ source: 'none' }`. `resolveTransitiveCoreRanges` in `scripts/fetch-metadata.ts` fills the transitive ones once every package is in memory. It walks declared dependencies on tracked packages by name, takes the newest version satisfying each range, and repeats until it finds a declared range.
  - The test `writes only the fields the engine reads on a version record` in `scripts/fetch-metadata.test.ts` pins this field set; extend it when adding a field.

## Build & config notes

- **Vite base path is hardcoded** `base: "/geostyler-compatibility/"` in `vite.config.ts` (for the GitHub Pages subpath); the router picks this up via `import.meta.env.BASE_URL`. Plugins: `tanstackRouter({ target: 'react', autoCodeSplitting: true })` then `react()`. Path alias `@` → `./src` (mirrors the tsconfig `@/*` alias).
- `tsconfig.json`: bundler resolution, `target ES2020`, `strict` + `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`, `noEmit`. Path alias `@/* → ./src/*`. `include: ["src", "scripts"]`.
- **Deploy**: `.github/workflows/build-deploy.yml` — triggers on push to `main`, daily cron (midnight UTC), or manual dispatch. Steps: `npm ci` → `fetch-metadata` → `build` → `cp dist/index.html dist/404.html` (GitHub Pages serves `404.html` for unknown paths, so deep links load the app) → upload `./dist` as a Pages artifact → `actions/deploy-pages`. Uses Node from `.nvmrc`.
- No `.env` file is needed — `fetch-metadata.ts` reads no token. `.env` stays gitignored in case one is added.
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

Single-context: `CONTEXT.md` glossary and `docs/adr/` at the repo root. See `docs/agents/domain.md`. Use the seven verdict names from `CONTEXT.md` (Conflict, Risk, Duplicate, Compatible, Shipped together, Independent, Unknown).
