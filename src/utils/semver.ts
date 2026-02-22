import * as semver from 'semver';

/**
 * Find the intersection of multiple semver ranges
 * Returns the most restrictive range that satisfies all input ranges
 */
export function intersectRanges(ranges: string[]): string | null {
  if (ranges.length === 0) return null;
  if (ranges.length === 1) return ranges[0];

  // Convert all ranges to a common format and find intersection
  try {
    // Get all versions that satisfy the first range up to version 20.0.0
    const testVersions: string[] = [];
    for (let major = 0; major <= 20; major++) {
      for (let minor = 0; minor <= 10; minor++) {
        testVersions.push(`${major}.${minor}.0`);
      }
    }

    // Filter to versions that satisfy ALL ranges
    const satisfyingVersions = testVersions.filter(version =>
      ranges.every(range => {
        try {
          return semver.satisfies(version, range);
        } catch {
          return false;
        }
      })
    );

    if (satisfyingVersions.length === 0) return null;

    // Return the range that covers the satisfying versions
    const minVersion = satisfyingVersions[0];
    const maxVersion = satisfyingVersions[satisfyingVersions.length - 1];

    if (minVersion === maxVersion) return minVersion;
    
    // Return a caret range from the minimum version
    return `^${minVersion}`;
  } catch (error) {
    console.error('Error intersecting ranges:', error);
    return null;
  }
}

/**
 * Check if two semver ranges overlap
 */
export function rangesOverlap(range1: string, range2: string): boolean {
  return intersectRanges([range1, range2]) !== null;
}

/**
 * Get the latest version from a list of versions
 */
export function getLatestVersion(versions: string[]): string | null {
  const validVersions = versions.filter(v => semver.valid(v));
  if (validVersions.length === 0) return null;
  
  return validVersions.sort((a, b) => semver.rcompare(a, b))[0];
}

/**
 * Check if a version satisfies a range
 */
export function satisfies(version: string, range: string): boolean {
  try {
    return semver.satisfies(version, range);
  } catch {
    return false;
  }
}

/**
 * Compare two versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  try {
    return semver.compare(v1, v2);
  } catch {
    return 0;
  }
}

/**
 * Check if version is a prerelease
 */
export function isPrerelease(version: string): boolean {
  try {
    const parsed = semver.parse(version);
    return parsed ? parsed.prerelease.length > 0 : false;
  } catch {
    return false;
  }
}
