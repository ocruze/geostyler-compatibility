/**
 * Package category classification
 */
export type PackageCategory = 'core' | 'ui' | 'style-parser' | 'data-parser';

/**
 * Format types supported by geostyler parsers
 */
export type StyleFormat = 
  | 'SLD 1.0.0'
  | 'SLD 1.1.0'
  | 'Mapbox GL v8'
  | 'QGIS 3.22'
  | 'QGIS 3.28+'
  | 'OpenLayers'
  | 'LYRX';

export type DataFormat =
  | 'GeoJSON'
  | 'WFS'
  | 'Shapefile';


/**
 * A package that defines a schema other packages consume.
 */
export type CorePackage = 'geostyler-style' | 'geostyler-data';

export type ModuleSystem = 'esm' | 'cjs' | 'types-only';

/**
 * The range a version declares on a core package, with where it came from.
 */
export type CoreRange =
  | { source: 'declared'; range: string }
  // Resolved through declared dependencies; origin is the version that declares the range.
  | { source: 'transitive'; range: string; origin: { name: string; version: string } }
  | { source: 'none' };

export type CoreRanges = Record<CorePackage, CoreRange>;

/**
 * One published version, trimmed to what the engine reads (ADR-0005).
 */
export interface PackageVersion {
  name: string;
  version: string;
  category: PackageCategory;

  // Three-axis inputs (ADR-0004)
  coreRanges: CoreRanges;
  // Dependencies on tracked packages only
  declaredDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  moduleSystem: ModuleSystem;

  publishDate: string;
  isPrerelease: boolean;
}

/**
 * Aggregated package information across all versions
 */
export interface Package {
  name: string;
  category: PackageCategory;
  format?: StyleFormat | DataFormat;
  versions: PackageVersion[];
  latestVersion: string;
  repositoryUrl: string;
}

export interface Dataset {
  generatedAt: string; // ISO timestamp
  packages: Package[];
}

// The aggregate outcome for one pair of package versions (ADR-0004).
export type Verdict =
  | 'conflict'
  | 'risk'
  | 'duplicate'
  | 'shipped-together'
  | 'compatible'
  | 'independent'
  | 'unknown';
