import type { Package, PackageVersion } from '@/types/compatibility';

import { evaluatePair, type PairEvaluation } from './evaluatePair';
import { candidateVersions } from './versions';

export const PAIR_MATRIX_DEFAULT_LIMIT = 20;

export interface PairMatrixOptions {
  includePrereleases?: boolean;
  // Newest versions kept per side; undefined keeps every candidate.
  limit?: number;
}

export interface PairMatrix {
  rows: PackageVersion[];
  cols: PackageVersion[];
  // cells[row][col]
  cells: PairEvaluation[][];
  // Candidates per side before the limit.
  total: { rows: number; cols: number };
}

export function buildPairMatrix(a: Package, b: Package, options: PairMatrixOptions = {}): PairMatrix {
  const includePrereleases = options.includePrereleases ?? false;
  const limit = 'limit' in options ? options.limit : PAIR_MATRIX_DEFAULT_LIMIT;
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
