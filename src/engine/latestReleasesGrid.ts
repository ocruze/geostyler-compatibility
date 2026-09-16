import { evaluatePair, type PairEvaluation } from '@/engine/evaluatePair';
import { candidateVersions } from '@/engine/versions';
import type { Package, PackageVersion } from '@/types/compatibility';

export function latestVersion(pkg: Package, includePrereleases = false): PackageVersion | undefined {
  return candidateVersions(pkg, includePrereleases)[0];
}

export interface LatestReleasesGrid {
  versions: PackageVersion[];
  // cells[row][col]; null on the diagonal.
  cells: (PairEvaluation | null)[][];
}

export function buildLatestReleasesGrid(packages: Package[], includePrereleases = false): LatestReleasesGrid {
  const versions = packages
    .map((pkg) => latestVersion(pkg, includePrereleases))
    .filter((v): v is PackageVersion => v !== undefined);
  const cells = versions.map((row) =>
    versions.map((col) => (row === col ? null : evaluatePair(row, col))),
  );
  return { versions, cells };
}
