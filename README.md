# GeoStyler Compatibility

A dashboard that answers one question: you use some GeoStyler packages, which versions do you install together?

Live site: https://ocruze.github.io/geostyler-compatibility/

## Pages

- **Check compatibility** (`/`): the stack builder. Tick the packages you use and pin a version where you must. You get a version set, one `npm install` line and a sentence naming the bottleneck. The stack and pins live in the URL (`?stack=a,b&pin=a@1.2.3`), so a link shares the same answer. With nothing ticked, the page shows the latest releases grid: every tracked package's latest release against every other.
- **Package page** (`/package/<name>`): category, format and module system, the version history with each core range and its source, and the pair matrix against another tracked package (newest 20 stable versions each side, expandable). "Add to stack" returns to the stack builder.
- **Docs** (`/docs`): the three axes and seven verdicts in plain language. Every example is computed from the dataset at render time.

Every page hides prereleases by default. The "Show prereleases" switch in the header is a browser preference, not URL state.

## How verdicts are computed

The engine compares a pair of package versions on three axes. Core range: the ranges both declare on `geostyler-style` and `geostyler-data`. Declared dependency: one lists the other in its `dependencies`. Shared peer: an external package both list in `peerDependencies` (`ol`, `react`, `d3`). The aggregate is one of seven verdicts: Conflict, Risk, Duplicate, Shipped together, Compatible, Independent, Unknown. Only a shared peer Conflict breaks `npm install`.

One engine in `src/engine/` computes every verdict, version set, grid and matrix in the browser. The build step computes no verdict. Definitions live in [CONTEXT.md](CONTEXT.md), the reasoning in [ADR-0004](docs/adr/0004-three-axis-verdict-model.md) and [ADR-0005](docs/adr/0005-single-runtime-engine.md).

## Data

`scripts/fetch-metadata.ts` reads the npm registry for the tracked packages and writes `src/data/packages.json` (`{ generatedAt, packages }`). It reads nothing else: no GitHub API, no token. Per version it keeps the version, publish date, prerelease flag and module system (`esm`, `cjs` or `types-only`). It also keeps the core ranges with their source (`declared`, `transitive` with its origin, or `none`), the declared dependencies on tracked packages, and the peer dependencies. Resolving transitive core ranges is the only computation at build time.

`src/data/` is generated and gitignored. Run `npm run fetch-metadata` before `dev` or `build`.

## Tracked packages

The list is fixed in [src/constants/repos.ts](src/constants/repos.ts):

- **Core**: geostyler-style, geostyler-data
- **UI**: geostyler, geostyler-legend
- **Style parsers**: SLD, Mapbox, QGIS, OpenLayers, LYRX
- **Data parsers**: GeoJSON, WFS, Shapefile

`geostyler-cql-parser` is not tracked: users do not install it directly.

## Development

Node 24 (pinned in `.nvmrc`).

```bash
npm install
npm run fetch-metadata   # writes src/data/packages.json
npm run dev              # http://localhost:5173/geostyler-compatibility/
```

Scripts:

- `npm run build`: `tsc` then `vite build`
- `npm run preview`: serve the built site
- `npm test`: Vitest, one run (`npm run test:watch` to watch)
- `npm run lint`: ESLint

Tests cover the engine against real registry records frozen in `src/engine/__fixtures__/versions.json`, the pipeline transform against recorded registry responses, the semver, date and URL helpers, and the tracked package list. Routes call only the engine, so there are no component tests.

## Deployment

[.github/workflows/build-deploy.yml](.github/workflows/build-deploy.yml) runs on every push to `main`, daily at midnight UTC, and on manual dispatch:

1. `npm ci`
2. `npm run fetch-metadata`
3. `npm run build`
4. `cp dist/index.html dist/404.html`, so GitHub Pages serves the app for deep links
5. Upload `dist/` as a Pages artifact and deploy it

The Vite base path is `/geostyler-compatibility/`; the router reads it from `import.meta.env.BASE_URL`.

## Stack

React 18, TypeScript, Vite 7, Ant Design v6, TanStack Router (file-based routes in `src/routes/`), `semver`.

## License

MIT

## Links

- [GeoStyler organisation](https://github.com/geostyler)
- [GeoStyler documentation](https://geostyler.github.io/geostyler/)
