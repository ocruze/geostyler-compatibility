import { evaluatePair, type PairEvaluation } from '@/engine/evaluatePair';
import type { Package, PackageVersion } from '@/types/compatibility';

// Versions are newest-first; a package with no stable release uses its newest prerelease.
export function latestStableVersion(pkg: Package): PackageVersion | undefined {
  return pkg.versions.find((v) => !v.isPrerelease) ?? pkg.versions[0];
}

export interface LatestReleasesGrid {
  versions: PackageVersion[];
  // cells[row][col]; null on the diagonal.
  cells: (PairEvaluation | null)[][];
}

export function buildLatestReleasesGrid(packages: Package[]): LatestReleasesGrid {
  const versions = packages
    .map(latestStableVersion)
    .filter((v): v is PackageVersion => v !== undefined);
  const cells = versions.map((row) =>
    versions.map((col) => (row === col ? null : evaluatePair(row, col))),
  );
  return { versions, cells };
}
