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
  | 'LYRX'
  | 'GeoCss'
  | 'SymCore'
  | 'Masterportal';

export type DataFormat =
  | 'GeoJSON'
  | 'WFS'
  | 'Shapefile';


/**
 * Package information including version and dependency details
 */
export interface PackageVersion {
  name: string;
  version: string;
  category: PackageCategory;
  format?: StyleFormat | DataFormat;
  
  // Dependency information
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  
  // Key compatibility markers
  geostylerStyleRange?: string;
  esmSupport: boolean;
  
  // Metadata
  publishDate: string;
  isPrerelease: boolean;
  
  // Links
  repositoryUrl: string;
  changelogUrl?: string;
  npmUrl: string;
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

/**
 * Compatibility conflict types
 */
export type ConflictReason =
  | 'geostyler-style-mismatch'
  | 'peer-dep-conflict'
  | 'esm-incompatible';

/**
 * Severity levels for conflicts
 */
export type ConflictSeverity = 'error' | 'warning' | 'info';

/**
 * Represents a compatibility conflict between packages
 */
export interface Conflict {
  reason: ConflictReason;
  severity: ConflictSeverity;
  message: string;
  packages: string[]; // package@version pairs
  details?: Record<string, unknown>;
}

/**
 * Result of compatibility check between package versions
 */
export interface CompatibilityCheck {
  packages: string[]; // package@version pairs
  compatible: boolean;
  conflicts: Conflict[];
  sharedGeostylerStyleVersions: string[];
  recommendations?: string[];
}

/**
 * Pre-computed compatibility matrix for quick lookups
 */
export interface CompatibilityMatrix {
  generated: string; // ISO timestamp
  packages: Package[];
  checks: Record<string, CompatibilityCheck>; // key: "pkg1@v1,pkg2@v2"
}

