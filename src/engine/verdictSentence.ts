import type { CoreAxis, DeclaredDependencyAxis, PairEvaluation } from '@/engine/evaluatePair';
import type { PackageVersion } from '@/types/compatibility';

export const versionLabel = (v: PackageVersion) => `${v.name} ${v.version}`;
const schemaNoun = (core: string) => (core === 'geostyler-style' ? 'style' : 'data');

function riskSentence({ a, b, core }: PairEvaluation): string {
  const axis = core.find((c) => c.outcome === 'disjoint') as CoreAxis;
  const self = [a, b].find((v) => v.name === axis.core);
  if (self) {
    const other = self === a ? b : a;
    const range = other.coreRanges[axis.core];
    const declared = range.source === 'none' ? '' : ` ${range.range}`;
    return `Not tested together: ${versionLabel(other)} needs ${axis.core}${declared}, not ${self.version}. Each gets its own copy; ${schemaNoun(axis.core)} objects may not match.`;
  }
  return `Not tested together: they target different ${axis.core} schemas. Each gets its own copy; ${schemaNoun(axis.core)} objects may not match.`;
}

export const shippedTogetherSentence = (core: string, declaration: string) =>
  `Different ${core} ranges, but ${declaration}, so upstream ships them together.`;

function compatibleSentence({ core, declared, peers }: PairEvaluation): string {
  const parts = [
    ...core.map((c) => `${c.core} ranges intersect`),
    ...declared.map((dep) => `${dep.from} declares this ${dep.to} version`),
    ...peers.map((p) => `${p.peer} peer ranges intersect`),
  ];
  return `Can be installed together: ${parts.join(', ')}.`;
}

export function verdictSentence(evaluation: PairEvaluation): string {
  const { verdict, core, declared, peers } = evaluation;
  switch (verdict) {
    case 'conflict': {
      const disjoint = peers.filter((p) => p.outcome === 'disjoint').map((p) => p.peer);
      return `Cannot be installed together: they need different versions of ${disjoint.join(' and ')}.`;
    }
    case 'risk':
      return riskSentence(evaluation);
    case 'duplicate': {
      const dep = declared.find((x) => !x.satisfied) as DeclaredDependencyAxis;
      return `Installs two copies of ${dep.to}. Works, but ${dep.from} uses its own bundled copy.`;
    }
    case 'shipped-together': {
      const dep = declared.find((x) => x.satisfied) as DeclaredDependencyAxis;
      const axis = core.find((c) => c.outcome === 'disjoint') as CoreAxis;
      return shippedTogetherSentence(axis.core, `${dep.from} declares this ${dep.to} version`);
    }
    case 'compatible':
      return compatibleSentence(evaluation);
    case 'independent':
      return 'No shared dependency to check.';
    case 'unknown': {
      const axis = core.find((c) => c.outcome === 'missing') as CoreAxis;
      const missing = axis.a.source === 'none' && evaluation.a.name !== axis.core ? evaluation.a : evaluation.b;
      return `No ${axis.core} range declared for ${versionLabel(missing)}.`;
    }
  }
}
