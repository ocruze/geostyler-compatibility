import * as semver from 'semver';

/**
 * Find the intersection of a set of semver ranges.
 * Returns a range string satisfied by EVERY input range, or null if the
 * intersection is empty (or all inputs are invalid).
 *
 * NOTE: inputs are ANDed by concatenation, which is exact for simple ranges
 * (carets/tildes/comparators). geostyler-style ranges in this dataset never
 * use `||`; if a `||` range is ever introduced, revisit this.
 */
export function intersectRanges(ranges: string[]): string | null {
  const valid = ranges.filter((r) => r.trim() && semver.validRange(r) !== null);
  if (valid.length === 0) return null;
  // Common case: all inputs identical -> return the pretty original.
  if (valid.every((r) => r === valid[0])) return valid[0];
  const combined = valid.join(' ');
  const normalized = semver.validRange(combined);
  if (!normalized) return null;
  // minVersion is null when the combined range is unsatisfiable (empty set).
  if (!semver.minVersion(normalized)) return null;
  return normalized;
}

export function rangesOverlap(range1: string, range2: string): boolean {
  return intersectRanges([range1, range2]) !== null;
}

/**
 * Make a normalized semver range readable for display.
 * `semver.validRange` output carries artifacts users shouldn't have to parse:
 * `-0` prerelease sentinels (`<11.0.0-0`) and redundant `>=` comparators from
 * concatenated intersections (`>=10.5.0 <11.0.0-0 >=10.4.0`).
 */
export function formatRangeForDisplay(range: string): string {
  const parts = Array.from(
    new Set(
      range
        .trim()
        .split(/\s+/)
        .map((p) => p.replace(/-0$/, ''))
    )
  );
  // Keep only the highest lower bound.
  const lowerBounds = parts.filter((p) => p.startsWith('>='));
  if (lowerBounds.length > 1) {
    const highest = lowerBounds.reduce((a, b) =>
      semver.gt(a.slice(2), b.slice(2)) ? a : b
    );
    return parts.filter((p) => !p.startsWith('>=') || p === highest).join(' ');
  }
  return parts.join(' ');
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
  return semver.compare(v1, v2);
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
