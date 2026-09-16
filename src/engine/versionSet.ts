import { CORE_PACKAGES, isCorePackage } from '@/constants/repos';
import type { CorePackage, Package, PackageVersion, Verdict } from '@/types/compatibility';
import { intersectRanges, satisfies } from '@/utils/semver';

import { EXPECTED_CORES, evaluatePair, type PairEvaluation } from './evaluatePair';
import { shippedTogetherSentence, verdictSentence, versionLabel } from './verdictSentence';
import { candidateVersions } from './versions';

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

// Only the cores some stack package constrains.
export type Anchors = Partial<Record<CorePackage, PackageVersion>>;

export interface VersionSet {
  anchors: Anchors;
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
  return shippedTogetherSentence(axis?.core ?? 'core', `${versionLabel(pair.via)} declares both`);
}

// A version missing a range its category needs would pair as Unknown, so it accepts no anchor.
function acceptsAnchors(v: PackageVersion, anchors: Anchors): boolean {
  return CORE_PACKAGES.every((core) => {
    const range = v.coreRanges[core];
    if (range.source === 'none') return !EXPECTED_CORES[v.category].includes(core);
    const anchor = anchors[core];
    return anchor === undefined || satisfies(anchor.version, range.range);
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

function chooseForAnchors(stack: Package[], candidates: Map<string, PackageVersion[]>, anchors: Anchors): PackageVersion[] | null {
  const chosen = new Map<string, PackageVersion>();
  for (const pkg of stack) {
    const version = isCorePackage(pkg.name)
      ? anchors[pkg.name]
      : candidates.get(pkg.name)!.find((v) => acceptsAnchors(v, anchors));
    if (version) chosen.set(pkg.name, version);
  }

  // A package another chosen version declares follows that range, even when none of its versions accepts the anchors.
  for (const pkg of stack) {
    if (isCorePackage(pkg.name)) continue;
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

// A core no stack package constrains has no anchor: one undefined entry keeps the loop to a single pass.
function anchorCandidates(
  core: CorePackage,
  packages: Package[],
  stack: Package[],
  candidates: Map<string, PackageVersion[]>,
  includePrereleases: boolean,
): (PackageVersion | undefined)[] {
  const constrained = stack.some(
    (pkg) => pkg.name === core || candidates.get(pkg.name)!.some((v) => v.coreRanges[core].source !== 'none'),
  );
  const corePkg = packages.find((p) => p.name === core);
  if (!constrained || !corePkg) return [undefined];
  return candidateVersions(corePkg, includePrereleases);
}

// Anchors newest-first, geostyler-style outer and geostyler-data inner; the first accepted set wins.
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
      const anchors: Anchors = {};
      if (styleAnchor) anchors['geostyler-style'] = styleAnchor;
      if (dataAnchor) anchors['geostyler-data'] = dataAnchor;
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
