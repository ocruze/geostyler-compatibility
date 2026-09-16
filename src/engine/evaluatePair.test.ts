import { describe, it, expect } from 'vitest';
import { evaluatePair } from '@/engine/evaluatePair';
import { fx } from './__fixtures__/versions';

describe('evaluatePair', () => {
  it('geostyler 18.6.0 with mapbox-parser 6.2.0 is Shipped together', () => {
    const result = evaluatePair(fx('geostyler', '18.6.0'), fx('geostyler-mapbox-parser', '6.2.0'));
    expect(result.verdict).toBe('shipped-together');
    expect(result.declared).toEqual([
      expect.objectContaining({ from: 'geostyler', to: 'geostyler-mapbox-parser', range: '^6.1.1', satisfied: true }),
    ]);
    expect(result.core.find((axis) => axis.core === 'geostyler-style')?.outcome).toBe('disjoint');
  });

  it('is symmetric', () => {
    const ab = evaluatePair(fx('geostyler', '18.6.0'), fx('geostyler-mapbox-parser', '6.2.0'));
    const ba = evaluatePair(fx('geostyler-mapbox-parser', '6.2.0'), fx('geostyler', '18.6.0'));
    expect(ba.verdict).toBe(ab.verdict);
  });

  it('geostyler-style 12.0.0 with qgis-parser 4.1.0 is Risk', () => {
    const result = evaluatePair(fx('geostyler-style', '12.0.0'), fx('geostyler-qgis-parser', '4.1.0'));
    expect(result.verdict).toBe('risk');
    expect(result.core).toEqual([
      expect.objectContaining({ core: 'geostyler-style', outcome: 'disjoint' }),
    ]);
    // The range on the core package itself is the core axis, not a declared dependency.
    expect(result.declared).toEqual([]);
  });

  it('the core package is Compatible with a parser only when its version satisfies the range', () => {
    expect(evaluatePair(fx('geostyler-sld-parser', '9.0.3'), fx('geostyler-style', '12.0.0')).verdict).toBe('compatible');
    expect(evaluatePair(fx('geostyler-sld-parser', '9.0.3'), fx('geostyler-style', '13.0.0')).verdict).toBe('risk');
  });

  it('geostyler-data 1.1.0 with geojson-parser 2.0.0 is Compatible', () => {
    const result = evaluatePair(fx('geostyler-data', '1.1.0'), fx('geostyler-geojson-parser', '2.0.0'));
    expect(result.verdict).toBe('compatible');
    expect(result.core).toEqual([
      expect.objectContaining({ core: 'geostyler-data', outcome: 'intersect' }),
    ]);
  });

  it('legend with ol ^6.5.0 and openlayers-parser with ol >=7.2 is Conflict', () => {
    const result = evaluatePair(fx('geostyler-legend', '2.2.0'), fx('geostyler-openlayers-parser', '4.1.2'));
    expect(result.verdict).toBe('conflict');
    expect(result.peers).toEqual([
      expect.objectContaining({ peer: 'ol', outcome: 'disjoint' }),
    ]);
  });

  it('a style parser with a data parser is Independent', () => {
    const result = evaluatePair(fx('geostyler-sld-parser', '9.0.3'), fx('geostyler-geojson-parser', '2.0.0'));
    expect(result.verdict).toBe('independent');
    expect(result.core).toEqual([]);
    expect(result.declared).toEqual([]);
    expect(result.peers).toEqual([]);
  });

  it('the two core packages are Independent', () => {
    const result = evaluatePair(fx('geostyler-style', '13.0.0'), fx('geostyler-data', '1.1.0'));
    expect(result.verdict).toBe('independent');
  });

  it('a version whose core range source is none is Unknown', () => {
    const result = evaluatePair(fx('geostyler-legend', '5.2.0'), fx('geostyler-sld-parser', '9.0.3'));
    expect(result.verdict).toBe('unknown');
    expect(result.core).toEqual([
      expect.objectContaining({ core: 'geostyler-style', outcome: 'missing' }),
    ]);
  });

  it('the core package itself against a version with source none is Unknown', () => {
    const result = evaluatePair(fx('geostyler-style', '13.0.0'), fx('geostyler-legend', '5.2.0'));
    expect(result.verdict).toBe('unknown');
  });

  it('an unsatisfied declared dependency with a missing core range is Unknown, not Duplicate', () => {
    const result = evaluatePair(fx('geostyler-legend', '5.2.0'), fx('geostyler-openlayers-parser', '5.7.1'));
    expect(result.verdict).toBe('unknown');
    expect(result.declared).toEqual([expect.objectContaining({ range: '5.1.2', satisfied: false })]);
  });

  it('a declared dependency the chosen version does not satisfy is Duplicate when core ranges intersect', () => {
    // geostyler 18.6.0 declares openlayers-parser ^5.7.0; 5.6.1 shares its geostyler-style major.
    const result = evaluatePair(fx('geostyler', '18.6.0'), fx('geostyler-openlayers-parser', '5.6.1'));
    expect(result.verdict).toBe('duplicate');
    expect(result.declared).toEqual([
      expect.objectContaining({ from: 'geostyler', to: 'geostyler-openlayers-parser', satisfied: false }),
    ]);
  });

  it('never reports a module system warning', () => {
    const { core, declared, peers } = evaluatePair(fx('geostyler-data', '1.1.0'), fx('geostyler', '18.6.0'));
    expect(JSON.stringify({ core, declared, peers })).not.toMatch(/esm|cjs|module/i);
  });
});
