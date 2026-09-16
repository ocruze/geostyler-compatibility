import { describe, it, expect } from 'vitest';
import { buildPairMatrix } from '@/engine/pairMatrix';
import type { Package, PackageVersion } from '@/types/compatibility';

import { fx, fxPackage } from './__fixtures__/versions';

const sld = fxPackage('geostyler-sld-parser', '9.0.3', '8.5.0', '8.4.2', '8.2.0', '7.3.0');
const ui = fxPackage('geostyler', '18.6.0', '17.0.0');

describe('buildPairMatrix', () => {
  it('evaluates every row version against every column version, newest first', () => {
    const matrix = buildPairMatrix(ui, sld);
    expect(matrix.rows.map((v) => v.version)).toEqual(['18.6.0', '17.0.0']);
    expect(matrix.cols.map((v) => v.version)).toEqual(['9.0.3', '8.5.0', '8.4.2', '8.2.0', '7.3.0']);
    expect(matrix.cells[0][2].verdict).toBe('compatible');
    expect(matrix.cells[0][1].verdict).toBe('shipped-together');
    expect(matrix.cells[1][4].verdict).toBe('compatible');
    expect(matrix.cells[1][0].verdict).toBe('risk');
  });

  it('keeps the newest versions up to the limit and reports the totals', () => {
    const matrix = buildPairMatrix(ui, sld, { limit: 2 });
    expect(matrix.cols.map((v) => v.version)).toEqual(['9.0.3', '8.5.0']);
    expect(matrix.total).toEqual({ rows: 2, cols: 5 });
    expect(buildPairMatrix(ui, sld, { limit: undefined }).cols).toHaveLength(5);
  });

  it('hides prereleases unless asked', () => {
    const next: PackageVersion = { ...fx('geostyler-sld-parser', '9.0.3'), version: '10.0.0-next.1', isPrerelease: true };
    const withNext: Package = { ...sld, versions: [next, ...sld.versions] };
    expect(buildPairMatrix(ui, withNext).cols[0].version).toBe('9.0.3');
    expect(buildPairMatrix(ui, withNext, { includePrereleases: true }).cols[0].version).toBe('10.0.0-next.1');
  });
});
