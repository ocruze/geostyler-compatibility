import type { Package, PackageVersion } from '@/types/compatibility';

// Newest-first; a package with no stable version uses its prereleases.
export function candidateVersions(pkg: Package, includePrereleases = false): PackageVersion[] {
  if (includePrereleases) return pkg.versions;
  const stable = pkg.versions.filter((v) => !v.isPrerelease);
  return stable.length > 0 ? stable : pkg.versions;
}
