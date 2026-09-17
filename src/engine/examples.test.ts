import { describe, it, expect } from 'vitest';

import { findTransitiveRangeExample, findVerdictExamples } from '@/engine/examples';
import type { PackageVersion, Verdict } from '@/types/compatibility';

import { fx, fxPackage } from './__fixtures__/versions';

const label = (v: PackageVersion) => `${v.name}@${v.version}`;
const pair = (e: { a: PackageVersion; b: PackageVersion } | null) => (e ? [label(e.a), label(e.b)].sort() : null);

const VERDICTS: Verdict[] = ['conflict', 'risk', 'duplicate', 'shipped-together', 'compatible', 'independent', 'unknown'];

describe('findVerdictExamples', () => {
  it('takes each example from the latest releases when a latest pair has the verdict', () => {
    const packages = [
      fxPackage('geostyler-style', '13.0.0', '12.0.0'),
      fxPackage('geostyler', '18.6.0'),
      fxPackage('geostyler-sld-parser', '9.0.3', '8.5.0'),
      fxPackage('geostyler-mapbox-parser', '6.2.0'),
      fxPackage('geostyler-data', '1.1.0'),
      fxPackage('geostyler-geojson-parser', '2.0.0'),
    ];
    const examples = findVerdictExamples(packages);
    expect(pair(examples['shipped-together'])).toEqual(['geostyler-mapbox-parser@6.2.0', 'geostyler@18.6.0']);
    for (const verdict of ['risk', 'compatible', 'independent'] as const) {
      const example = examples[verdict]!;
      expect(example.verdict).toBe(verdict);
      const latest = packages.map((p) => p.versions[0]);
      expect(latest).toContain(example.a);
      expect(latest).toContain(example.b);
    }
  });

  it('falls back to older versions newest-first for a verdict no latest pair has', () => {
    const packages = [
      fxPackage('geostyler', '18.6.0'),
      fxPackage('geostyler-legend', '5.2.1', '2.2.0'),
      fxPackage('geostyler-openlayers-parser', '5.7.1', '5.6.1', '4.1.2'),
    ];
    const examples = findVerdictExamples(packages);
    expect(pair(examples.conflict)).toEqual(['geostyler-legend@2.2.0', 'geostyler-openlayers-parser@5.7.1']);
    expect(pair(examples.duplicate)).toEqual(['geostyler-openlayers-parser@5.6.1', 'geostyler@18.6.0']);
  });

  it('returns null for a verdict no pair of versions has', () => {
    const packages = [fxPackage('geostyler-sld-parser', '9.0.3'), fxPackage('geostyler-geojson-parser', '2.0.0')];
    const examples = findVerdictExamples(packages);
    expect(examples.independent?.verdict).toBe('independent');
    for (const verdict of VERDICTS.filter((v) => v !== 'independent')) expect(examples[verdict]).toBeNull();
  });

  it('every example carries the verdict it illustrates', () => {
    const packages = [
      fxPackage('geostyler-style', '13.0.0'),
      fxPackage('geostyler', '18.6.0', '0.1.0'),
      fxPackage('geostyler-legend', '5.2.1', '2.2.0'),
      fxPackage('geostyler-sld-parser', '9.0.3'),
      fxPackage('geostyler-openlayers-parser', '5.7.1', '5.6.1', '4.1.2'),
      fxPackage('geostyler-mapbox-parser', '6.2.0'),
      fxPackage('geostyler-data', '1.1.0'),
      fxPackage('geostyler-geojson-parser', '2.0.0'),
    ];
    const examples = findVerdictExamples(packages);
    for (const verdict of VERDICTS) expect(examples[verdict]?.verdict).toBe(verdict);
  });

  it('leaves prereleases out unless asked', () => {
    const legendPrerelease = { ...fx('geostyler-legend', '2.2.0'), version: '2.2.0-next.1', isPrerelease: true };
    const legend = fxPackage('geostyler-legend', '5.2.1');
    const packages = [
      fxPackage('geostyler', '18.6.0'),
      { ...legend, versions: [...legend.versions, legendPrerelease] },
      fxPackage('geostyler-openlayers-parser', '5.7.1', '4.1.2'),
    ];
    expect(findVerdictExamples(packages).conflict).toBeNull();
    expect(pair(findVerdictExamples(packages, true).conflict)).toEqual(['geostyler-legend@2.2.0-next.1', 'geostyler-openlayers-parser@5.7.1']);
  });
});

describe('findTransitiveRangeExample', () => {
  it('returns the newest version whose core range was inherited through a declared dependency', () => {
    const packages = [fxPackage('geostyler-openlayers-parser', '5.7.1'), fxPackage('geostyler-legend', '5.2.1', '5.2.0', '2.2.0')];
    const example = findTransitiveRangeExample(packages);
    expect(example && label(example.version)).toBe('geostyler-legend@5.2.0');
    expect(example?.core).toBe('geostyler-style');
    expect(example?.range).toEqual({ source: 'transitive', range: '^10.3.0', origin: { name: 'geostyler-openlayers-parser', version: '5.1.2' } });
  });

  it('returns null when every range is declared or missing', () => {
    expect(findTransitiveRangeExample([fxPackage('geostyler-sld-parser', '9.0.3'), fxPackage('geostyler', '0.1.0')])).toBeNull();
  });
});
