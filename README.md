# GeoStyler Compatibility Dashboard

A web interface for checking compatibility between GeoStyler packages — style parsers, data parsers, and UI components.

## 🎯 Features

- **Package Overview**: Browse all GeoStyler packages with their latest versions and metadata
- **Compatibility Matrix**: Pre-computed compatibility checks for package combinations
- **Package Details**: View version history, dependencies, and geostyler-style ranges
- **Package Comparison**: Compare multiple packages to detect compatibility conflicts
- **ESM/CJS Tracking**: See which packages support ESM vs CJS module systems
- **Format Support**: Track which parsers support which style/data formats

## 🏗️ Architecture

### Data Generation (Build Time)

1. **Fetch Metadata** ([scripts/fetch-metadata.ts](scripts/fetch-metadata.ts))
   - Pulls package data from npm registry
   - Fetches repository metadata from GitHub API
   - Outputs: `public/data/packages.json`

2. **Compute Compatibility** ([scripts/compute-compatibility.ts](scripts/compute-compatibility.ts))
   - Analyzes geostyler-style version ranges
   - Checks ESM/CJS compatibility
   - Detects peer dependency conflicts
   - Outputs: `public/data/compatibility-matrix.json`

### Frontend (Runtime)

- **React SPA** with Vite
- **TanStack Router** for type-safe routing
- **TanStack Query** for data loading with caching
- Loads static JSON files generated at build time

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm/yarn/pnpm

### Installation

```bash
npm install
```

### Local Development

1. Generate data (requires GitHub token for API access):
   ```bash
   # Create .env file
   cp .env.example .env
   # Add your GITHUB_TOKEN to .env
   
   # Fetch metadata and compute compatibility
   npm run generate-data
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
- `npm run fetch-metadata` - Fetch package data from npm/GitHub
- `npm run compute-compatibility` - Generate compatibility matrix
- `npm run generate-data` - Run both data generation steps

## 🔄 Deployment

The site automatically deploys to GitHub Pages via GitHub Actions:

- **Trigger**: Push to `main`, daily at midnight UTC, or manual dispatch
- **Build**: Fetches fresh package data, computes compatibility, builds SPA
- **Deploy**: Pushes to `gh-pages` branch

### GitHub Actions Workflow

See [.github/workflows/build-deploy.yml](.github/workflows/build-deploy.yml)

The workflow uses the built-in `GITHUB_TOKEN` for API requests (5,000 req/hour limit).

## 📊 Data Model

### Package Structure

```typescript
interface Package {
  name: string;
  category: 'pivot' | 'ui' | 'style-parser' | 'data-parser';
  format?: string; // e.g., 'SLD', 'Mapbox GL v8'
  versions: PackageVersion[];
  latestVersion: string;
  repositoryUrl: string;
}
```

### Compatibility Check

```typescript
interface CompatibilityCheck {
  packages: string[]; // package@version pairs
  compatible: boolean;
  conflicts: Conflict[];
  sharedGeostylerStyleVersions: string[];
  recommendations?: string[];
}
```

## 🧩 Compatibility Rules

1. **geostyler-style Range Intersection**
   - Primary compatibility check
   - All parsers depend on `geostyler-style`
   - Packages are compatible if their geostyler-style ranges overlap

2. **ESM/CJS Compatibility**
   - Mixed ESM and CJS packages may cause bundling issues
   - Flagged as warning (not error)

3. **Peer Dependencies**
   - Checks if peer dependency requirements are satisfied
   - Example: `geostyler-openlayers-parser` requires `ol: ">=7.4"`

## 📦 Monitored Packages

See [src/constants/repos.ts](src/constants/repos.ts) for the full list:

- **Pivot**: geostyler-style, geostyler-data
- **UI**: geostyler, geostyler-legend
- **Style Parsers**: SLD, Mapbox, QGIS, OpenLayers, LYRX, GeoCss, SymCore, Masterportal
- **Data Parsers**: GeoJSON, WFS, Shapefile

## 🛠️ Tech Stack

- **Build**: Vite, TypeScript
- **Frontend**: React 18, TanStack Router, TanStack Query
- **Data Processing**: Node.js, npm registry API, GitHub API
- **Deployment**: GitHub Actions, GitHub Pages

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

## 🔗 Links

- [GeoStyler Organization](https://github.com/geostyler)
- [GeoStyler Documentation](https://geostyler.github.io/geostyler/)