import { CORE_PACKAGES } from '@/constants/repos';
import type { CorePackage, CoreRange, Package, PackageVersion, Verdict } from '@/types/compatibility';

import { evaluatePair, type PairEvaluation } from './evaluatePair';
import { buildLatestReleasesGrid } from './latestReleasesGrid';
import { candidateVersions } from './versions';

const VERDICTS: Verdict[] = ['conflict', 'risk', 'duplicate', 'shipped-together', 'compatible', 'independent', 'unknown'];

// One real pair per verdict; null when no pair of tracked versions has it.
export type VerdictExamples = Record<Verdict, PairEvaluation | null>;

/**
 * Finds one pair of versions for each verdict, so documentation can show real examples.
 * Latest releases are preferred; older versions are then searched newest-first, stopping once every verdict has one.
 */
export function findVerdictExamples(packages: Package[], includePrereleases = false): VerdictExamples {
  const examples = Object.fromEntries(VERDICTS.map((v) => [v, null])) as VerdictExamples;
  const complete = () => VERDICTS.every((v) => examples[v] !== null);
  const consider = (evaluation: PairEvaluation) => {
    if (examples[evaluation.verdict] === null) examples[evaluation.verdict] = evaluation;
  };

  const grid = buildLatestReleasesGrid(packages, includePrereleases);
  grid.cells.forEach((row, i) => row.forEach((cell, j) => {
    if (cell && i < j) consider(cell);
  }));

  for (let i = 0; i < packages.length && !complete(); i++) {
    for (let j = i + 1; j < packages.length && !complete(); j++) {
      for (const a of candidateVersions(packages[i], includePrereleases)) {
        for (const b of candidateVersions(packages[j], includePrereleases)) {
          if (complete()) break;
          consider(evaluatePair(a, b));
        }
      }
    }
  }
  return examples;
}

export interface TransitiveRangeExample {
  version: PackageVersion;
  core: CorePackage;
  range: Extract<CoreRange, { source: 'transitive' }>;
}

/** The newest version that inherits a core range through a declared dependency, in tracked order. */
export function findTransitiveRangeExample(packages: Package[], includePrereleases = false): TransitiveRangeExample | null {
  for (const pkg of packages) {
    for (const version of candidateVersions(pkg, includePrereleases)) {
      for (const core of CORE_PACKAGES) {
        const range = version.coreRanges[core];
        if (range.source === 'transitive') return { version, core, range };
      }
    }
  }
  return null;
}
