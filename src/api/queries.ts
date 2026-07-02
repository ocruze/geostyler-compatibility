import type { Package, CompatibilityMatrix, PackageVersion } from '@/types/compatibility';
import packagesData from '@/data/packages.json';
import compatibilityData from '@/data/compatibility-matrix.json';
import { intersectRanges } from '@/utils/semver';
import * as semver from 'semver';

/**
 * Hook to fetch all packages
 */
export function usePackages() {
  return {
    data: packagesData as Package[],
    isLoading: false,
    error: null as Error | null,
  };
}

/**
 * Hook to fetch compatibility matrix
 */
export function useCompatibilityMatrix() {
  return {
    data: compatibilityData as CompatibilityMatrix,
    isLoading: false,
    error: null as Error | null,
  };
}

/**
 * Hook to get a specific package by name
 */
export function usePackage(name: string) {
  const { data: packages, ...rest } = usePackages();
  
  const pkg = packages?.find(p => p.name === name);
  
  return {
    ...rest,
    data: pkg,
  };
}

/**
 * Hook to get compatibility check for specific packages
 */
export function useCompatibilityCheck(packageIds: string[]) {
  const { data: matrix, ...rest } = useCompatibilityMatrix();
  
  const key = packageIds.sort().join(',');
  const check = matrix?.checks[key];
  
  return {
    ...rest,
    data: check,
  };
}

/**
 * Interface for version compatibility info
 */
export interface VersionCompatibilityResult {
  compatible: boolean;
  sharedRange: string | null;
  reason?: string;
  warnings: string[];
}

/**
 * Check compatibility between two specific versions
 */
export function checkVersionCompatibility(
  v1: PackageVersion,
  v2: PackageVersion
): VersionCompatibilityResult {
  const warnings: string[] = [];
  
  // Check geostyler-style compatibility (for style parsers)
  const range1 = v1.geostylerStyleRange;
  const range2 = v2.geostylerStyleRange;
  
  let sharedRange: string | null = null;
  let compatible = true;
  
  if (range1 && range2) {
    sharedRange = intersectRanges([range1, range2]);
    if (!sharedRange) {
      compatible = false;
      return {
        compatible,
        sharedRange,
        reason: `No overlapping geostyler-style versions (${range1} ∩ ${range2} = ∅)`,
        warnings,
      };
    }
  }
  
  // Peer-dependency conflicts (both directions) — matches the build script
  const peerConflict = (a: PackageVersion, b: PackageVersion): string | null => {
    const range = a.peerDependencies?.[b.name];
    if (!range) return null;
    try {
      return semver.satisfies(b.version, range)
        ? null
        : `${a.name}@${a.version} requires peer ${b.name}@${range}, but found ${b.version}`;
    } catch {
      return null;
    }
  };
  const peerReason = peerConflict(v1, v2) ?? peerConflict(v2, v1);
  if (peerReason) {
    return { compatible: false, sharedRange, reason: peerReason, warnings };
  }

  // Check ESM/CJS compatibility
  const esm1 = v1.esmSupport;
  const esm2 = v2.esmSupport;
  if (esm1 !== esm2) {
    warnings.push(`Mixed module systems: ${v1.name} is ${esm1 ? 'ESM' : 'CJS'}, ${v2.name} is ${esm2 ? 'ESM' : 'CJS'}`);
  }
  
  return {
    compatible,
    sharedRange,
    warnings,
  };
}

/**
 * A mutually-compatible version pick, one entry per requested package.
 */
export interface RecommendedSet {
  versions: { name: string; version: string }[];
  /** The geostyler-style version anchoring the set (null when no package has a range). */
  gsVersion: string | null;
  /** Non-fatal issues in the chosen set (e.g. mixed ESM/CJS). */
  warnings: string[];
}

/**
 * Find the newest mutually-compatible version set for the given packages.
 *
 * Strategy: walk concrete geostyler-style versions newest-first; for each
 * candidate, pick every package's latest stable version whose
 * `geostylerStyleRange` accepts it (packages without ranges contribute their
 * latest stable version). The first candidate whose full set also passes the
 * pairwise `checkVersionCompatibility` (peer deps etc.) wins. Returns null
 * when no set exists among tracked versions.
 */
export function findRecommendedSet(
  packageNames: string[],
  allPackages: Package[]
): RecommendedSet | null {
  const pkgs = packageNames
    .map((n) => allPackages.find((p) => p.name === n))
    .filter((p): p is Package => !!p);
  if (pkgs.length < 2) return null;

  // Prefer stable releases; fall back to prereleases only if that's all there is.
  // Versions are pre-sorted newest-first in the dataset.
  const stableVersions = (p: Package) => {
    const s = p.versions.filter((v) => !v.isPrerelease);
    return s.length > 0 ? s : p.versions;
  };

  // Pairwise-validate a candidate set; returns collected warnings, or null if
  // any pair is incompatible.
  const validate = (chosen: PackageVersion[]): string[] | null => {
    const warnings: string[] = [];
    for (let i = 0; i < chosen.length; i++) {
      for (let j = i + 1; j < chosen.length; j++) {
        const r = checkVersionCompatibility(chosen[i], chosen[j]);
        if (!r.compatible) return null;
        warnings.push(...r.warnings);
      }
    }
    return Array.from(new Set(warnings));
  };

  const toResult = (chosen: PackageVersion[], gsVersion: string | null, warnings: string[]): RecommendedSet => ({
    versions: chosen.map((v) => ({ name: v.name, version: v.version })),
    gsVersion,
    warnings,
  });

  const hasRange = (p: Package) =>
    p.name !== 'geostyler-style' && stableVersions(p).some((v) => v.geostylerStyleRange);

  const gsPkg = allPackages.find((p) => p.name === 'geostyler-style');
  const candidates = gsPkg ? stableVersions(gsPkg).map((v) => v.version) : [];

  if (pkgs.some(hasRange) && candidates.length > 0) {
    for (const gsVersion of candidates) {
      const chosen: PackageVersion[] = [];
      let ok = true;
      for (const p of pkgs) {
        if (p.name === 'geostyler-style') {
          const v = p.versions.find((x) => x.version === gsVersion);
          if (!v) { ok = false; break; }
          chosen.push(v);
        } else if (hasRange(p)) {
          const v = stableVersions(p).find(
            (x) => x.geostylerStyleRange && safeSatisfies(gsVersion, x.geostylerStyleRange)
          );
          if (!v) { ok = false; break; }
          chosen.push(v);
        } else {
          chosen.push(stableVersions(p)[0]);
        }
      }
      if (!ok) continue;
      const warnings = validate(chosen);
      if (warnings === null) continue;
      return toResult(chosen, gsVersion, warnings);
    }
    return null;
  }

  // No geostyler-style coupling involved: latest stable of each, validated pairwise.
  const chosen = pkgs.map((p) => stableVersions(p)[0]);
  const warnings = validate(chosen);
  if (warnings === null) return null;
  return toResult(chosen, null, warnings);
}

function safeSatisfies(version: string, range: string): boolean {
  try {
    return semver.satisfies(version, range);
  } catch {
    return false;
  }
}

/**
 * Result shape returned by getVersionCompatibilityMatrix for a pair of packages.
 */
export interface VersionCompatibilityMatrixData {
  pkg1Name: string;
  pkg1Versions: PackageVersion[];
  pkg2Name: string;
  pkg2Versions: PackageVersion[];
  matrix: Record<string, Record<string, VersionCompatibilityResult>>;
}

/**
 * Get version compatibility matrix for multiple packages
 */
export function getVersionCompatibilityMatrix(
  packageIds: string[],
  allPackages: Package[]
): VersionCompatibilityMatrixData | null {
  if (packageIds.length < 2) return null;
  
  // Parse package IDs (format: "name@version")
  const packageData = packageIds.map(id => {
    const lastAtIndex = id.lastIndexOf('@');
    const name = id.slice(0, lastAtIndex);
    const version = id.slice(lastAtIndex + 1);
    const pkg = allPackages.find(p => p.name === name);
    return {
      name,
      version,
      pkg,
      allVersions: pkg?.versions || [],
    };
  });
  
  if (packageData.length < 2) return null;
  
  // For now, return a simple structure for 2 packages
  // Can be extended for multiple packages
  if (packageData.length === 2) {
    const [pkg1Data, pkg2Data] = packageData;
    
    // Versions are pre-sorted newest-first, so this selects the newest 20 versions for performance
    const versions1 = pkg1Data.allVersions.slice(0, 20);
    const versions2 = pkg2Data.allVersions.slice(0, 20);
    
    const matrix: Record<string, Record<string, VersionCompatibilityResult>> = {};
    
    for (const v1 of versions1) {
      matrix[v1.version] = {};
      for (const v2 of versions2) {
        matrix[v1.version][v2.version] = checkVersionCompatibility(v1, v2);
      }
    }
    
    return {
      pkg1Name: pkg1Data.name,
      pkg1Versions: versions1,
      pkg2Name: pkg2Data.name,
      pkg2Versions: versions2,
      matrix,
    };
  }
  
  return null;
}
