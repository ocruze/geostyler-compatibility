import type { CorePackage } from '../types/compatibility';

/**
 * List of geostyler repositories to track.
 * geostyler-cql-parser is not tracked: users do not install it directly.
 */
export const REPOS = [
  // core style
  'geostyler/geostyler-style',
  // geostyler ui components
  'geostyler/geostyler',
  'geostyler/geostyler-legend',
  // style parsers
  'geostyler/geostyler-sld-parser',
  'geostyler/geostyler-mapbox-parser',
  'geostyler/geostyler-qgis-parser',
  'geostyler/geostyler-openlayers-parser',
  'geostyler/geostyler-lyrx-parser',
  // data parsers
  'geostyler/geostyler-data',
  'geostyler/geostyler-geojson-parser',
  'geostyler/geostyler-wfs-parser',
  'geostyler/geostyler-shapefile-parser',
] as const;

/**
 * Package name to npm package name mapping (derived from REPOS).
 */
export const REPO_TO_NPM: Record<string, string> = Object.fromEntries(
  REPOS.map((repo) => [repo, repo.split('/')[1]]),
);

/**
 * npm names of the tracked packages.
 */
export const TRACKED_PACKAGES: string[] = Object.values(REPO_TO_NPM);

export const CORE_PACKAGES: CorePackage[] = ['geostyler-style', 'geostyler-data'];
