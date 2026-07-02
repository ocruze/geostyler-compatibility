# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`geostyler-compatibility` is a React + Vite single-page app: a dashboard for checking compatibility between GeoStyler packages (style parsers, data parsers, UI components). It is `private` (not published to npm) and deploys to GitHub Pages. Stack: React 18, Vite 7, TypeScript 5.6, **Ant Design v6** (`antd` + `@ant-design/icons`), **TanStack Router** (file-based routing).

This app is one of four independent GeoStyler repos co-located under the parent directory — see `../CLAUDE.md` for the cross-package picture.

## Commands (npm)

- Dev server: `npm run dev` (Vite, http://localhost:5173)
- Build: `npm run build` (`tsc && vite build`)
- Preview built site: `npm run preview`
- Regenerate data: `npm run generate-data` (= `fetch-metadata` then `compute-compatibility`)
  - `npm run fetch-metadata` — `tsx scripts/fetch-metadata.ts`
  - `npm run compute-compatibility` — `tsx scripts/compute-compatibility.ts`
- Lint: `npm run lint` (ESLint 9 flat config — passes cleanly)
- Test: `npm test` (Vitest, one-shot) / `npm run test:watch`

Node is pinned via `.nvmrc` to `24.14.0`. Vitest covers `src/utils/semver.ts`, `src/api/queries.ts`, and `scripts/fetch-metadata.ts`'s `detectEsmSupport` (3 test files, 18 tests). No Storybook, no commitlint/semantic-release in this app.

## Gotchas (read before running)

- **`src/data/` is generated and gitignored.** `src/data/packages.json` and `src/data/compatibility-matrix.json` do not exist in a fresh clone. Run `npm run generate-data` (or the two scripts) before `dev`/`build`, or the app has no data. `fetch-metadata` writes `src/data/packages.json`; `compute-compatibility` reads that and writes `src/data/compatibility-matrix.json`.
- **`eslint.config.js` is a flat config** wiring `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`; it ignores `src/routeTree.gen.ts` and `src/data/**`, and disables `react-refresh/only-export-components` for `src/routes/**/*.tsx` (TanStack file-routes must export a non-component `Route` alongside the component).
- **`fetch-metadata` does NOT use `GITHUB_TOKEN`.** The script only fetches the npm registry (`registry.npmjs.org`); it reads no GitHub token and calls no GitHub API. It does honor `HTTPS_PROXY`/`HTTP_PROXY` (via undici `ProxyAgent`). The CI workflow still passes `secrets.GITHUB_TOKEN` to the step, but it is unused. `.env.example` still lists it as required — that file is stale too but out of scope here. Don't add token-fetch logic assuming it's wired up — it isn't.
- **AntD v6 renamed some props vs. v4/v5 muscle memory**: `Alert` uses `title` (not `message`), `Space` uses `orientation` (not `direction`) — both confirmed current in the installed `antd@6.3.1` types (`message`/`direction` are `@deprecated`). Don't "fix" existing `title=`/`orientation=` usages in this codebase.
- **Peer-dependency conflicts are a first-class incompatibility reason**, checked bidirectionally in both the build script (`scripts/compute-compatibility.ts`) and the runtime check (`checkVersionCompatibility` in `src/api/queries.ts`) via `semver.satisfies` — not just a geostyler-style-range/ESM check.

## Architecture

- **Entry**: `src/main.tsx` — wraps the app in antd `ConfigProvider` (theme: `colorPrimary '#1677ff'`, `theme.defaultAlgorithm`, `enUS` locale) + an AntD `<App>` wrapper (enables `App.useApp()` context for message/modal/notification) + TanStack `RouterProvider`. Router has `basepath: import.meta.env.BASE_URL ?? '/'`, `defaultPreload: 'intent'`, `defaultNotFoundComponent`, and `defaultErrorComponent`.
- **Routing**: file-based routes in `src/routes/` (`__root.tsx`, `index.tsx`, `compare.tsx`, `docs.tsx`, `package.$name.tsx`). `src/routeTree.gen.ts` is **generated** by `@tanstack/router-plugin` (Vite) — do not hand-edit.
- **Data access**: `src/api/queries.ts`. **TanStack Query is not used** — the `use*` hooks (`usePackages`, `useCompatibilityMatrix`, `usePackage`, `useCompatibilityCheck`) are synchronous wrappers over statically-imported `@/data/*.json`, returning `{ data, isLoading: false, error: null }`. Adding real async/caching would mean introducing `@tanstack/react-query` (not currently a dep).
- **Core compatibility logic**: `checkVersionCompatibility(v1, v2)` in `src/api/queries.ts` intersects each version's `geostylerStyleRange` via `intersectRanges` from `src/utils/semver.ts` (real `semver.validRange`/`minVersion` math — ranges are ANDed by string concatenation, which is exact for the simple caret/tilde/comparator ranges this dataset uses; revisit if a `||` range is ever introduced), marks incompatible on empty intersection, checks `peerDependencies` bidirectionally (hard incompatibility), and warns (not errors) on ESM/CJS (`esmSupport`) mismatch. The tracked-repo list and `REPO_TO_NPM` map (derived from `REPOS`) live in `src/constants/repos.ts`; shared types in `src/types/compatibility.ts`. `intersectRanges` is the shared core used by both the build script and the runtime check. ESM support is detected from real npm metadata (`detectEsmSupport` in `scripts/fetch-metadata.ts`, checking `type`/`module`/`exports.import`) — not version-number guessing.
- **The Compare page's version matrix (`compare.tsx`) defaults to a "problems only" view** (only rows/columns with a real incompatibility or warning) and the full 20×20 grid is collapsed by default — the wall-of-green/oversized-a11y-snapshot problem this note used to warn about no longer happens on the default view. If you expand the full grid or disable "problems only", the a11y tree can still be large; prefer `browser_take_screenshot` over `browser_snapshot` in that expanded state.
- **Data pipeline** (build-time, Node via `tsx`): `scripts/fetch-metadata.ts` reads npm registry metadata for the tracked packages and emits `src/data/packages.json` (per-version `category`/`geostylerStyleRange`/`esmSupport`, plus Package-level `format`), tracking per-package fetch failures and setting `process.exitCode = 1` if any occur; `scripts/compute-compatibility.ts` computes the pairwise (+ some UI/parser triplet) compatibility matrix into `src/data/compatibility-matrix.json`.

## Build & config notes

- **Vite base path is hardcoded** `base: "/geostyler-compatibility/"` in `vite.config.ts` (for the GitHub Pages subpath); the router picks this up via `import.meta.env.BASE_URL`. Plugins: `tanstackRouter({ target: 'react', autoCodeSplitting: true })` then `react()`. Path alias `@` → `./src` (mirrors the tsconfig `@/*` alias).
- `tsconfig.json`: bundler resolution, `target ES2020`, `strict` + `noUnusedLocals`/`noUnusedParameters`/`noFallthroughCasesInSwitch`, `noEmit`. Path alias `@/* → ./src/*`. `include: ["src", "scripts"]`.
- **Deploy**: `.github/workflows/build-deploy.yml` — triggers on push to `main`, daily cron (midnight UTC), or manual dispatch. Steps: `npm ci` → `fetch-metadata` → `compute-compatibility` → `build` → upload `./dist` as a Pages artifact → `actions/deploy-pages`. Uses Node from `.nvmrc`.
- `.env` is NOT required for local data generation — `fetch-metadata.ts` reads no token. `.env.example` still exists and lists `GITHUB_TOKEN` as required, which is stale; keep secrets out of git regardless (`.env` is gitignored).
- **Dependency updates are Renovate-managed** (`renovate.json`) — most of the commit history is automated `chore(deps)` bumps rather than manual upgrades.
