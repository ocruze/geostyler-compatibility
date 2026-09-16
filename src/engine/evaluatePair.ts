import * as semver from 'semver';

import { CORE_PACKAGES, isCorePackage } from '@/constants/repos';
import type {
  CorePackage,
  CoreRange,
  PackageCategory,
  PackageVersion,
  Verdict,
} from '@/types/compatibility';
import { intersectRanges, satisfies } from '@/utils/semver';

// A missing range on one of these is Unknown; a missing range elsewhere is not an axis.
export const EXPECTED_CORES: Record<PackageCategory, CorePackage[]> = {
  core: [],
  ui: ['geostyler-style'],
  'style-parser': ['geostyler-style'],
  'data-parser': ['geostyler-data'],
};

export type CoreAxisOutcome = 'intersect' | 'disjoint' | 'missing';

export interface CoreAxis {
  core: CorePackage;
  a: CoreRange;
  b: CoreRange;
  outcome: CoreAxisOutcome;
  // Display only: the range both sides accept, when neither side is the core itself.
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
  outcome: 'intersect' | 'disjoint';
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

function intersects(a: string, b: string): boolean {
  try {
    return semver.intersects(a, b);
  } catch {
    return false;
  }
}

function coreAxis(core: CorePackage, a: PackageVersion, b: PackageVersion): CoreAxis | null {
  const rangeA = a.coreRanges[core];
  const rangeB = b.coreRanges[core];
  const axis = (outcome: CoreAxisOutcome, intersection: string | null = null): CoreAxis => ({
    core, a: rangeA, b: rangeB, outcome, intersection,
  });

  // One side is the core package itself: its version must satisfy the other's range.
  if (a.name === core || b.name === core) {
    const [self, other] = a.name === core ? [a, b] : [b, a];
    const range = other.coreRanges[core];
    if (range.source !== 'none') {
      return axis(satisfies(self.version, range.range) ? 'intersect' : 'disjoint');
    }
    return EXPECTED_CORES[other.category].includes(core) ? axis('missing') : null;
  }

  if (rangeA.source !== 'none' && rangeB.source !== 'none') {
    if (!intersects(rangeA.range, rangeB.range)) return axis('disjoint');
    return axis('intersect', intersectRanges([rangeA.range, rangeB.range]));
  }

  const missing = rangeA.source === 'none' ? a : b;
  const present = missing === a ? b : a;
  if (present.coreRanges[core].source !== 'none' && EXPECTED_CORES[missing.category].includes(core)) {
    return axis('missing');
  }
  return null;
}

function declaredAxis(from: PackageVersion, to: PackageVersion): DeclaredDependencyAxis | null {
  // A range on a core package is the core axis, not a declared dependency.
  if (isCorePackage(to.name)) return null;
  const range = from.declaredDependencies[to.name];
  if (!range) return null;
  return { from: from.name, to: to.name, range, version: to.version, satisfied: satisfies(to.version, range) };
}

function sharedPeers(a: PackageVersion, b: PackageVersion): SharedPeerAxis[] {
  return Object.keys(a.peerDependencies)
    .filter((peer) => peer in b.peerDependencies)
    .sort()
    .map((peer) => {
      const rangeA = a.peerDependencies[peer];
      const rangeB = b.peerDependencies[peer];
      const outcome = intersects(rangeA, rangeB) ? 'intersect' : 'disjoint';
      return {
        peer, a: rangeA, b: rangeB, outcome,
        intersection: outcome === 'intersect' ? intersectRanges([rangeA, rangeB]) : null,
      };
    });
}

// Strongest verdict first, in the order ADR-0004 and #28 fix.
function aggregate(core: CoreAxis[], declared: DeclaredDependencyAxis[], peers: SharedPeerAxis[]): Verdict {
  if (peers.some((p) => p.outcome === 'disjoint')) return 'conflict';
  if (core.some((c) => c.outcome === 'disjoint')) {
    return declared.some((d) => d.satisfied) ? 'shipped-together' : 'risk';
  }
  if (core.some((c) => c.outcome === 'missing')) return 'unknown';
  if (declared.some((d) => !d.satisfied)) return 'duplicate';
  if (core.length > 0 || declared.length > 0 || peers.length > 0) return 'compatible';
  return 'independent';
}

/** Evaluate two package versions on the three axes of ADR-0004. Symmetric in its arguments. */
export function evaluatePair(a: PackageVersion, b: PackageVersion): PairEvaluation {
  const core = CORE_PACKAGES
    .map((c) => coreAxis(c, a, b))
    .filter((axis): axis is CoreAxis => axis !== null);
  const declared = [declaredAxis(a, b), declaredAxis(b, a)]
    .filter((axis): axis is DeclaredDependencyAxis => axis !== null);
  const peers = sharedPeers(a, b);
  return { a, b, verdict: aggregate(core, declared, peers), core, declared, peers };
}
