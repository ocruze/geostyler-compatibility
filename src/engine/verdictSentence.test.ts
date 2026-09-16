import { describe, it, expect } from 'vitest';
import { evaluatePair } from '@/engine/evaluatePair';
import { verdictSentence } from '@/engine/verdictSentence';
import type { PackageVersion } from '@/types/compatibility';
import fixture from './__fixtures__/versions.json';

const records = fixture as PackageVersion[];
const fx = (name: string, version: string): PackageVersion => {
  const record = records.find((r) => r.name === name && r.version === version);
  if (!record) throw new Error(`fixture missing ${name}@${version}`);
  return record;
};
const sentence = (a: PackageVersion, b: PackageVersion) => verdictSentence(evaluatePair(a, b));

describe('verdictSentence', () => {
  it('names the disjoint peer on Conflict', () => {
    expect(sentence(fx('geostyler-legend', '2.2.0'), fx('geostyler-openlayers-parser', '4.1.2')))
      .toBe('Cannot be installed together: they need different versions of ol.');
  });

  it('names the declaring package on Shipped together', () => {
    expect(sentence(fx('geostyler', '18.6.0'), fx('geostyler-mapbox-parser', '6.2.0')))
      .toBe('Different geostyler-style ranges, but geostyler declares this geostyler-mapbox-parser version, so upstream ships them together.');
  });

  it('quotes the range the core package misses on Risk', () => {
    expect(sentence(fx('geostyler-style', '12.0.0'), fx('geostyler-qgis-parser', '4.1.0')))
      .toBe('Not tested together: geostyler-qgis-parser 4.1.0 needs geostyler-style ^10.0.0, not 12.0.0. Each gets its own copy; style objects may not match.');
  });

  it('names the version lacking a range on Unknown', () => {
    expect(sentence(fx('geostyler-sld-parser', '9.0.3'), fx('geostyler-legend', '5.2.0')))
      .toBe('No geostyler-style range declared for geostyler-legend 5.2.0.');
  });

  it('names both copies on Duplicate', () => {
    expect(sentence(fx('geostyler-legend', '5.2.0'), fx('geostyler-openlayers-parser', '5.7.1')))
      .toBe('Installs two copies of geostyler-openlayers-parser. Works, but geostyler-legend uses its own bundled copy.');
  });

  it('never mentions the module system', () => {
    for (const a of records) for (const b of records) {
      if (a !== b) expect(sentence(a, b)).not.toMatch(/esm|cjs|module/i);
    }
  });
});
