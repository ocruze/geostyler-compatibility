/**
 * List of geostyler repositories to track
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
  'geostyler/geostyler-geocss-parser',
  'geostyler/geostyler-symcore-parser',
  'geostyler/geostyler-masterportal-parser',
  // data parsers
  'geostyler/geostyler-data',
  'geostyler/geostyler-geojson-parser',
  'geostyler/geostyler-wfs-parser',
  'geostyler/geostyler-shapefile-parser',
  'geostyler/geostyler-cql-parser',
] as const;

/**
 * Package name to npm package name mapping (derived from REPOS).
 */
export const REPO_TO_NPM: Record<string, string> = Object.fromEntries(
  REPOS.map((repo) => [repo, repo.split('/')[1]]),
);
