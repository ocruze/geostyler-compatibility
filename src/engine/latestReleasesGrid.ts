import { evaluatePair, type PairEvaluation } from '@/engine/evaluatePair';
import type { Package, PackageVersion } from '@/types/compatibility';

/**
 * The newest stable version of a package. Falls back to the newest prerelease
 * when the package has no stable release at all. Versions are newest-first.
 */
export function latestStableVersion(pkg: Package): PackageVersion | undefined {
  return pkg.versions.find((v) => !v.isPrerelease) ?? pkg.versions[0];
}

export interface LatestReleasesGrid {
  versions: PackageVersion[];
  // cells[row][col]; null on the diagonal.
  cells: (PairEvaluation | null)[][];
}

/**
 * Every tracked package's latest stable release against every other.
 */
export function buildLatestReleasesGrid(packages: Package[]): LatestReleasesGrid {
  const versions = packages
    .map(latestStableVersion)
    .filter((v): v is PackageVersion => v !== undefined);
  const cells = versions.map((row) =>
    versions.map((col) => (row === col ? null : evaluatePair(row, col))),
  );
  return { versions, cells };
}
