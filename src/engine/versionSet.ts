import { CORE_PACKAGES, isCorePackage } from '@/constants/repos';
import type { CorePackage, Package, PackageVersion, Verdict } from '@/types/compatibility';
import { intersectRanges, satisfies } from '@/utils/semver';

import { EXPECTED_CORES, evaluatePair, type PairEvaluation } from './evaluatePair';
import { shippedTogetherSentence, verdictSentence, versionLabel } from './verdictSentence';
import { candidateVersions } from './versions';

const ACCEPTED: Verdict[] = ['compatible', 'shipped-together', 'independent'];

export interface VersionSetOptions {
  includePrereleases?: boolean;
  // Package name to version; a version the dataset does not have is ignored.
  pins?: Record<string, string>;
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

export interface PartialSet {
  removed: string;
  set: VersionSet;
}

export type VersionSetResult =
  | { status: 'found'; set: VersionSet }
  | {
      status: 'none';
      // Pairs the closest attempt rejected.
      failing: StackPair[];
      // The pinned package in the most failing pairs, if any pin is involved.
      relax: string | null;
      partial: PartialSet | null;
    };

// Exactly the stack at its chosen versions; a core package appears only when it is in the stack.
export function installCommand(versions: PackageVersion[]): string {
  return `npm install ${versions.map((v) => `${v.name}@${v.version}`).join(' ')}`;
}

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

interface Search {
  stack: Package[];
  candidates: Map<string, PackageVersion[]>;
  pins: Map<string, PackageVersion>;
}

function chooseForAnchors({ stack, candidates, pins }: Search, anchors: Anchors): PackageVersion[] | null {
  const chosen = new Map<string, PackageVersion>();
  for (const pkg of stack) {
    const version =
      pins.get(pkg.name) ??
      (isCorePackage(pkg.name) ? anchors[pkg.name] : candidates.get(pkg.name)!.find((v) => acceptsAnchors(v, anchors)));
    if (version) chosen.set(pkg.name, version);
  }

  // A package another chosen version declares follows that range, even when none of its versions accepts the anchors.
  for (const pkg of stack) {
    if (isCorePackage(pkg.name) || pins.has(pkg.name)) continue;
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
  { stack, candidates, pins }: Search,
  includePrereleases: boolean,
): (PackageVersion | undefined)[] {
  const pinned = pins.get(core);
  if (pinned) return [pinned];
  const constrained = stack.some(
    (pkg) => pkg.name === core || candidates.get(pkg.name)!.some((v) => v.coreRanges[core].source !== 'none'),
  );
  const corePkg = packages.find((p) => p.name === core);
  if (!constrained || !corePkg) return [undefined];
  return candidateVersions(corePkg, includePrereleases);
}

const rejected = (pairs: StackPair[]) => pairs.filter((p) => !ACCEPTED.includes(p.verdict));

function pinToRelax(failing: StackPair[], pins: Map<string, PackageVersion>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const name of pins.keys()) {
    const count = failing.filter((p) => p.a.name === name || p.b.name === name).length;
    if (count > bestCount) [best, bestCount] = [name, count];
  }
  return best;
}

// Anchors newest-first, geostyler-style outer and geostyler-data inner; the first accepted set wins.
function search(packages: Package[], stackNames: string[], options: VersionSetOptions, withPartial: boolean): VersionSetResult {
  const includePrereleases = options.includePrereleases ?? false;
  const stack = stackNames
    .map((name) => packages.find((p) => p.name === name))
    .filter((p): p is Package => p !== undefined);
  const candidates = new Map(stack.map((pkg) => [pkg.name, candidateVersions(pkg, includePrereleases)]));
  const pins = new Map<string, PackageVersion>();
  for (const pkg of stack) {
    const pinned = pkg.versions.find((v) => v.version === options.pins?.[pkg.name]);
    if (pinned) pins.set(pkg.name, pinned);
  }
  const state: Search = { stack, candidates, pins };
  const newest = stack.map((pkg) => candidates.get(pkg.name)![0]);

  let closest: StackPair[] | null = null;
  for (const styleAnchor of anchorCandidates('geostyler-style', packages, state, includePrereleases)) {
    for (const dataAnchor of anchorCandidates('geostyler-data', packages, state, includePrereleases)) {
      const anchors: Anchors = {};
      if (styleAnchor) anchors['geostyler-style'] = styleAnchor;
      if (dataAnchor) anchors['geostyler-data'] = dataAnchor;
      const chosen = chooseForAnchors(state, anchors);
      if (!chosen) continue;
      const pairs = evaluateSet(chosen);
      if (rejected(pairs).length === 0) {
        return { status: 'found', set: { anchors, versions: chosen, newest, pairs } };
      }
      if (!closest || rejected(pairs).length < rejected(closest).length) closest = pairs;
    }
  }

  // No anchor let every package in: show the pins with everything else at its newest.
  const failing = rejected(closest ?? evaluateSet(stack.map((pkg) => pins.get(pkg.name) ?? candidates.get(pkg.name)![0])));
  return {
    status: 'none',
    failing,
    relax: pinToRelax(failing, pins),
    partial: withPartial ? partialSet(packages, stackNames, options) : null,
  };
}

// The first stack package whose removal leaves a set, tried in stack order.
function partialSet(packages: Package[], stackNames: string[], options: VersionSetOptions): PartialSet | null {
  if (stackNames.length < 2) return null;
  for (const removed of stackNames) {
    const rest = stackNames.filter((name) => name !== removed);
    const result = search(packages, rest, options, false);
    if (result.status === 'found') return { removed, set: result.set };
  }
  return null;
}

export function buildVersionSet(packages: Package[], stackNames: string[], options: VersionSetOptions = {}): VersionSetResult {
  return search(packages, stackNames, options, true);
}
