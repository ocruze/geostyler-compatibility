# GeoStyler Compatibility Dashboard

A web interface for checking compatibility between GeoStyler packages — style parsers, data parsers, and UI components.

## 🎯 Features

- **Stack builder**: tick the packages you use, get a version set, an `npm install` line and the bottleneck
- **Package page**: version history with core ranges and the pair matrix against any other tracked package
- **Format Support**: Track which parsers support which style/data formats

## 🏗️ Architecture

### Data Generation (Build Time)

1. **Fetch Metadata** ([scripts/fetch-metadata.ts](scripts/fetch-metadata.ts))
   - Pulls package data from the npm registry and trims it to what the engine reads
   - Resolves transitive core ranges, the one build-time computation
   - Outputs: `src/data/packages.json` (`{ generatedAt, packages }`; the app footer shows `generatedAt` as a UTC date)

Every verdict and version set is computed in the browser by `src/engine/` (see `docs/adr/0005-single-runtime-engine.md`).

### Frontend (Runtime)

- **React SPA** with Vite
- **TanStack Router** for type-safe routing
- No runtime data fetching — static JSON (generated at build time) is imported directly; `usePackages` in `src/api/queries.ts` is a synchronous wrapper, not TanStack Query

## 🚀 Getting Started

### Prerequisites

- Node.js 24 (pinned via `.nvmrc`, currently `24.14.0`)
- npm/yarn/pnpm

### Installation

```bash
npm install
```

### Local Development

1. Generate data:
   ```bash
   npm run fetch-metadata
   ```

2. Start dev server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:5173

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run fetch-metadata` - Fetch package data from the npm registry
- `npm test` - Run the Vitest test suite
- `npm run lint` - Lint with ESLint

## 🔄 Deployment

The site automatically deploys to GitHub Pages via GitHub Actions:

- **Trigger**: Push to `main`, daily at midnight UTC, or manual dispatch
- **Build**: Fetches fresh package data, builds SPA, then copies `dist/index.html` to `dist/404.html` so GitHub Pages serves the app for deep links
- **Deploy**: Uploads `./dist` as a Pages artifact via `actions/upload-pages-artifact` + `actions/deploy-pages` — no `gh-pages` branch

### GitHub Actions Workflow

See [.github/workflows/build-deploy.yml](.github/workflows/build-deploy.yml)

## 📊 Data Model

### Package Structure

```typescript
interface Package {
  name: string;
   category: 'core' | 'ui' | 'style-parser' | 'data-parser';
  format?: string; // e.g., 'SLD', 'Mapbox GL v8'
  versions: PackageVersion[];
  latestVersion: string;
  repositoryUrl: string;
}
```

## 🧩 Compatibility Rules

A pair of versions is evaluated on three axes (core range, declared dependency, shared peer) into one of seven verdicts: Conflict, Risk, Duplicate, Compatible, Shipped together, Independent, Unknown. Definitions live in [CONTEXT.md](CONTEXT.md) and [ADR-0004](docs/adr/0004-three-axis-verdict-model.md).

## 📦 Monitored Packages

See [src/constants/repos.ts](src/constants/repos.ts) for the full list:

- **Core**: geostyler-style, geostyler-data
- **UI**: geostyler, geostyler-legend
- **Style Parsers**: SLD, Mapbox, QGIS, OpenLayers, LYRX
- **Data Parsers**: GeoJSON, WFS, Shapefile

## 🛠️ Tech Stack

- **Build**: Vite, TypeScript
- **Frontend**: React 18, TanStack Router, Ant Design v6
- **Data Processing**: Node.js, npm registry API
- **Deployment**: GitHub Actions, GitHub Pages

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 🔗 Links

- [GeoStyler Organization](https://github.com/geostyler)
- [GeoStyler Documentation](https://geostyler.github.io/geostyler/)