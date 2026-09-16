import type { Package, PackageVersion } from '@/types/compatibility';

import { evaluatePair, type PairEvaluation } from './evaluatePair';
import { candidateVersions } from './versions';

export const PAIR_MATRIX_DEFAULT_LIMIT = 20;

export interface PairMatrixOptions {
  includePrereleases?: boolean;
  // Every candidate instead of the newest 20 per side.
  all?: boolean;
}

export interface PairMatrix {
  rows: PackageVersion[];
  cols: PackageVersion[];
  cells: PairEvaluation[][];
  total: { rows: number; cols: number };
}

export function buildPairMatrix(a: Package, b: Package, options: PairMatrixOptions = {}): PairMatrix {
  const includePrereleases = options.includePrereleases ?? false;
  const limit = options.all ? undefined : PAIR_MATRIX_DEFAULT_LIMIT;
  const allRows = candidateVersions(a, includePrereleases);
  const allCols = candidateVersions(b, includePrereleases);
  const rows = allRows.slice(0, limit);
  const cols = allCols.slice(0, limit);
  return {
    rows,
    cols,
    cells: rows.map((row) => cols.map((col) => evaluatePair(row, col))),
    total: { rows: allRows.length, cols: allCols.length },
  };
}
