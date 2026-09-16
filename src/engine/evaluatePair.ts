import * as semver from 'semver';

import { CORE_PACKAGES } from '@/constants/repos';
import type {
  CorePackage,
  CoreRange,
  PackageCategory,
  PackageVersion,
  Verdict,
} from '@/types/compatibility';
import { intersectRanges } from '@/utils/semver';

// The core package each category is expected to declare a range on. A missing
// range on an expected core is Unknown; a missing range elsewhere is not an axis.
const EXPECTED_CORES: Record<PackageCategory, CorePackage[]> = {
  core: [],
  ui: ['geostyler-style'],
  'style-parser': ['geostyler-style'],
  'data-parser': ['geostyler-data'],
};

export type CoreAxisOutcome = 'agree' | 'disjoint' | 'unknown';

export interface CoreAxis {
  core: CorePackage;
  a: CoreRange;
  b: CoreRange;
  outcome: CoreAxisOutcome;
  // The range both sides accept, when the outcome is agree and neither side is the core itself.
  intersection: string | null;
}

export interface DeclaredDependencyAxis {
  from: string;
  to: string;
  range: string;
  version: string;
  satisfied: boolean;
}

export interface SharedPeerAxis {
  peer: string;
  a: string;
  b: string;
  intersection: string | null;
}

export interface PairEvaluation {
  a: PackageVersion;
  b: PackageVersion;
  verdict: Verdict;
  core: CoreAxis[];
  declared: DeclaredDependencyAxis[];
  peers: SharedPeerAxis[];
}

function safeSatisfies(version: string, range: string): boolean {
  try {
    return semver.satisfies(version, range, { includePrerelease: true });
  } catch {
    return false;
  }
}

function safeIntersects(a: string, b: string): boolean {
  try {
    return semver.intersects(a, b, { includePrerelease: true });
  } catch {
    return false;
  }
}

function coreAxis(core: CorePackage, a: PackageVersion, b: PackageVersion): CoreAxis | null {
  const rangeA = a.coreRanges[core];
  const rangeB = b.coreRanges[core];
  const detail = (outcome: CoreAxisOutcome, intersection: string | null = null): CoreAxis => ({
    core, a: rangeA, b: rangeB, outcome, intersection,
  });

  // One side is the core package itself: its version must satisfy the other's range.
  if (a.name === core || b.name === core) {
    const [self, other] = a.name === core ? [a, b] : [b, a];
    const range = other.coreRanges[core];
    if (range.source !== 'none') {
      return detail(safeSatisfies(self.version, range.range) ? 'agree' : 'disjoint');
    }
    return EXPECTED_CORES[other.category].includes(core) ? detail('unknown') : null;
  }

  if (rangeA.source !== 'none' && rangeB.source !== 'none') {
    if (!safeIntersects(rangeA.range, rangeB.range)) return detail('disjoint');
    return detail('agree', intersectRanges([rangeA.range, rangeB.range]));
  }

  // One range is missing: an axis only when the side lacking it should have one.
  const missing = rangeA.source === 'none' ? a : b;
  const present = missing === a ? b : a;
  if (present.coreRanges[core].source !== 'none' && EXPECTED_CORES[missing.category].includes(core)) {
    return detail('unknown');
  }
  return null;
}

function declaredAxis(from: PackageVersion, to: PackageVersion): DeclaredDependencyAxis | null {
  // A range on a core package is the core axis, not a declared dependency.
  if (CORE_PACKAGES.includes(to.name as CorePackage)) return null;
  const range = from.declaredDependencies[to.name];
  if (!range) return null;
  return {
    from: from.name,
    to: to.name,
    range,
    version: to.version,
    satisfied: safeSatisfies(to.version, range),
  };
}

function sharedPeers(a: PackageVersion, b: PackageVersion): SharedPeerAxis[] {
  return Object.keys(a.peerDependencies)
    .filter((peer) => peer in b.peerDependencies)
    .sort()
    .map((peer) => {
      const rangeA = a.peerDependencies[peer];
      const rangeB = b.peerDependencies[peer];
      return {
        peer,
        a: rangeA,
        b: rangeB,
        intersection: safeIntersects(rangeA, rangeB) ? intersectRanges([rangeA, rangeB]) ?? rangeA : null,
      };
    });
}

function aggregate(core: CoreAxis[], declared: DeclaredDependencyAxis[], peers: SharedPeerAxis[]): Verdict {
  if (peers.some((p) => p.intersection === null)) return 'conflict';
  const declaredSatisfied = declared.some((d) => d.satisfied);
  if (core.some((c) => c.outcome === 'disjoint')) {
    return declaredSatisfied ? 'shipped-together' : 'risk';
  }
  if (declared.some((d) => !d.satisfied)) return 'duplicate';
  if (core.some((c) => c.outcome === 'unknown')) return 'unknown';
  if (core.length > 0 || declared.length > 0 || peers.length > 0) return 'compatible';
  return 'independent';
}

/**
 * Evaluate two package versions on the three axes of ADR-0004 and aggregate
 * them into one verdict. Symmetric in its arguments.
 */
export function evaluatePair(a: PackageVersion, b: PackageVersion): PairEvaluation {
  const core = CORE_PACKAGES
    .map((c) => coreAxis(c, a, b))
    .filter((axis): axis is CoreAxis => axis !== null);
  const declared = [declaredAxis(a, b), declaredAxis(b, a)]
    .filter((axis): axis is DeclaredDependencyAxis => axis !== null);
  const peers = sharedPeers(a, b);
  return { a, b, verdict: aggregate(core, declared, peers), core, declared, peers };
}
