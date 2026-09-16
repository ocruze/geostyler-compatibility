import { CORE_PACKAGES } from '@/constants/repos';
import type { CorePackage, Package, PackageCategory, PackageVersion, Verdict } from '@/types/compatibility';
import { intersectRanges, satisfies } from '@/utils/semver';

import { evaluatePair, type PairEvaluation } from './evaluatePair';
import { verdictSentence, versionLabel } from './verdictSentence';

// A missing range on one of these excludes every anchor; a missing range elsewhere constrains nothing.
const REQUIRED_CORES: Record<PackageCategory, CorePackage[]> = {
  core: [],
  ui: ['geostyler-style'],
  'style-parser': ['geostyler-style'],
  'data-parser': ['geostyler-data'],
};

const ACCEPTED: Verdict[] = ['compatible', 'shipped-together', 'independent'];

export interface VersionSetOptions {
  includePrereleases?: boolean;
}

export interface StackPair {
  a: PackageVersion;
  b: PackageVersion;
  evaluation: PairEvaluation;
  // The pair verdict, or Shipped together when a third chosen version declares both members.
  verdict: Verdict;
  via?: PackageVersion;
}

export interface VersionSet {
  anchors: Record<CorePackage, PackageVersion>;
  // Chosen versions, in stack order.
  versions: PackageVersion[];
  // Newest candidate of each stack package, in stack order.
  newest: PackageVersion[];
  pairs: StackPair[];
}

export type VersionSetResult = { status: 'found'; set: VersionSet } | { status: 'none' };

export function stackPairSentence(pair: StackPair): string {
  if (!pair.via) return verdictSentence(pair.evaluation);
  const axis = pair.evaluation.core.find((c) => c.outcome === 'disjoint');
  return `Different ${axis?.core ?? 'core'} ranges, but ${versionLabel(pair.via)} declares both, so upstream ships them together.`;
}

// Newest-first; a package with no stable version uses its prereleases.
export function candidateVersions(pkg: Package, includePrereleases = false): PackageVersion[] {
  if (includePrereleases) return pkg.versions;
  const stable = pkg.versions.filter((v) => !v.isPrerelease);
  return stable.length > 0 ? stable : pkg.versions;
}

const isCore = (name: string) => CORE_PACKAGES.includes(name as CorePackage);

function acceptsAnchors(v: PackageVersion, anchors: Record<CorePackage, PackageVersion>): boolean {
  return CORE_PACKAGES.every((core) => {
    const range = v.coreRanges[core];
    if (range.source === 'none') return !REQUIRED_CORES[v.category].includes(core);
    return satisfies(anchors[core].version, range.range);
  });
}

// A Risk pair is shipped together when another chosen version declares both members in satisfied ranges.
function declaredBoth(a: PackageVersion, b: PackageVersion, chosen: PackageVersion[]): PackageVersion | undefined {
  return chosen.find(
    (c) =>
      c !== a && c !== b &&
      [a, b].every((v) => {
        const range = c.declaredDependencies[v.name];
        return range !== undefined && satisfies(v.version, range);
      }),
  );
}

function evaluateSet(chosen: PackageVersion[]): StackPair[] {
  const pairs: StackPair[] = [];
  for (let i = 0; i < chosen.length; i++) {
    for (let j = i + 1; j < chosen.length; j++) {
      const evaluation = evaluatePair(chosen[i], chosen[j]);
      const via = evaluation.verdict === 'risk' ? declaredBoth(chosen[i], chosen[j], chosen) : undefined;
      pairs.push({
        a: chosen[i], b: chosen[j], evaluation, via,
        verdict: via ? 'shipped-together' : evaluation.verdict,
      });
    }
  }
  return pairs;
}

function chooseForAnchors(
  stack: Package[],
  candidates: Map<string, PackageVersion[]>,
  anchors: Record<CorePackage, PackageVersion>,
): PackageVersion[] | null {
  const chosen = new Map<string, PackageVersion>();
  for (const pkg of stack) {
    const version = isCore(pkg.name)
      ? pkg.versions.find((v) => v.version === anchors[pkg.name as CorePackage].version)
      : candidates.get(pkg.name)!.find((v) => acceptsAnchors(v, anchors));
    if (version) chosen.set(pkg.name, version);
  }

  // A package another chosen package declares follows that range, as npm would resolve it.
  for (const pkg of stack) {
    if (isCore(pkg.name)) continue;
    const ranges = [...chosen.values()]
      .filter((c) => c.name !== pkg.name && c.declaredDependencies[pkg.name] !== undefined)
      .map((c) => c.declaredDependencies[pkg.name]);
    if (ranges.length === 0) continue;
    const range = intersectRanges(ranges);
    const version = range ? candidates.get(pkg.name)!.find((v) => satisfies(v.version, range)) : undefined;
    if (version) chosen.set(pkg.name, version);
  }

  if (chosen.size !== stack.length) return null;
  return stack.map((pkg) => chosen.get(pkg.name)!);
}

// Anchors for a core only matter when a stack package constrains it; otherwise the newest one stands in.
function anchorCandidates(
  core: CorePackage,
  packages: Package[],
  stack: Package[],
  candidates: Map<string, PackageVersion[]>,
  includePrereleases: boolean,
): PackageVersion[] {
  const corePkg = packages.find((p) => p.name === core);
  if (!corePkg) return [];
  const all = candidateVersions(corePkg, includePrereleases);
  const constrained = stack.some(
    (pkg) => pkg.name === core || candidates.get(pkg.name)!.some((v) => v.coreRanges[core].source !== 'none'),
  );
  return constrained ? all : all.slice(0, 1);
}

/**
 * The version set for a stack: anchors newest-first (geostyler-style outer, geostyler-data inner), each
 * package at its newest candidate accepting the anchors, then declared dependencies followed, and the first
 * set whose pairs are all Compatible, Shipped together or Independent wins.
 */
export function buildVersionSet(
  packages: Package[],
  stackNames: string[],
  options: VersionSetOptions = {},
): VersionSetResult {
  const includePrereleases = options.includePrereleases ?? false;
  const stack = stackNames
    .map((name) => packages.find((p) => p.name === name))
    .filter((p): p is Package => p !== undefined);
  if (stack.length === 0) return { status: 'none' };

  const candidates = new Map(stack.map((pkg) => [pkg.name, candidateVersions(pkg, includePrereleases)]));
  const styleAnchors = anchorCandidates('geostyler-style', packages, stack, candidates, includePrereleases);
  const dataAnchors = anchorCandidates('geostyler-data', packages, stack, candidates, includePrereleases);

  for (const styleAnchor of styleAnchors) {
    for (const dataAnchor of dataAnchors) {
      const anchors = { 'geostyler-style': styleAnchor, 'geostyler-data': dataAnchor };
      const chosen = chooseForAnchors(stack, candidates, anchors);
      if (!chosen) continue;
      const pairs = evaluateSet(chosen);
      if (pairs.every((p) => ACCEPTED.includes(p.verdict))) {
        return {
          status: 'found',
          set: { anchors, versions: chosen, newest: stack.map((pkg) => candidates.get(pkg.name)![0]), pairs },
        };
      }
    }
  }
  return { status: 'none' };
}
