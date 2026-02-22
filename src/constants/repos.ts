/**
 * List of geostyler repositories to track
 */
export const REPOS = [
  // pivot style
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
 * Package name to npm package name mapping
 */
export const REPO_TO_NPM: Record<string, string> = {
  'geostyler/geostyler-style': 'geostyler-style',
  'geostyler/geostyler': 'geostyler',
  'geostyler/geostyler-legend': 'geostyler-legend',
  'geostyler/geostyler-sld-parser': 'geostyler-sld-parser',
  'geostyler/geostyler-mapbox-parser': 'geostyler-mapbox-parser',
  'geostyler/geostyler-qgis-parser': 'geostyler-qgis-parser',
  'geostyler/geostyler-openlayers-parser': 'geostyler-openlayers-parser',
  'geostyler/geostyler-lyrx-parser': 'geostyler-lyrx-parser',
  'geostyler/geostyler-geocss-parser': 'geostyler-geocss-parser',
  'geostyler/geostyler-symcore-parser': 'geostyler-symcore-parser',
  'geostyler/geostyler-masterportal-parser': 'geostyler-masterportal-parser',
  'geostyler/geostyler-data': 'geostyler-data',
  'geostyler/geostyler-geojson-parser': 'geostyler-geojson-parser',
  'geostyler/geostyler-wfs-parser': 'geostyler-wfs-parser',
  'geostyler/geostyler-shapefile-parser': 'geostyler-shapefile-parser',
  'geostyler/geostyler-cql-parser': 'geostyler-cql-parser',
};

/**
 * ESM support version thresholds per package
 * Based on research: most parsers went ESM in v6.x (2024)
 */
export const ESM_VERSION_THRESHOLD: Record<string, string> = {
  'geostyler-style': '9.0.0',
  'geostyler': '10.0.0',
  'geostyler-legend': '5.0.0',
  'geostyler-sld-parser': '6.0.0',
  'geostyler-mapbox-parser': '6.0.0',
  'geostyler-qgis-parser': '5.0.0',
  'geostyler-openlayers-parser': '5.0.0',
  'geostyler-lyrx-parser': '4.0.0',
  'geostyler-geocss-parser': '5.0.0',
  'geostyler-symcore-parser': '3.0.0',
  'geostyler-masterportal-parser': '2.0.0',
  'geostyler-data': '4.0.0',
  'geostyler-geojson-parser': '4.0.0',
  'geostyler-wfs-parser': '5.0.0',
  'geostyler-shapefile-parser': '3.0.0',
};
