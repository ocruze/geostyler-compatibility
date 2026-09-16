import { describe, it, expect } from 'vitest';
import { buildVersionSet, stackPairSentence } from '@/engine/versionSet';
import type { Package, PackageVersion } from '@/types/compatibility';

import { fx, fxPackage } from './__fixtures__/versions';

const style = fxPackage('geostyler-style', '13.0.0', '12.0.0', '11.1.0', '10.5.0');
const data = fxPackage('geostyler-data', '1.1.0', '1.0.0');
const ui = fxPackage('geostyler', '18.6.0');
const sld = fxPackage('geostyler-sld-parser', '9.0.3', '8.5.0', '8.4.2', '8.2.0');
const mapbox = fxPackage('geostyler-mapbox-parser', '6.2.0', '6.1.1');
const qgis = fxPackage('geostyler-qgis-parser', '4.1.0');
const openlayers = fxPackage('geostyler-openlayers-parser', '5.7.1', '5.6.1', '5.1.2', '4.1.2');
const geojson = fxPackage('geostyler-geojson-parser', '2.0.0', '1.0.1');
const wfs = fxPackage('geostyler-wfs-parser', '3.0.1');

const packages: Package[] = [style, ui, sld, mapbox, qgis, openlayers, data, geojson, wfs];

const found = (result: ReturnType<typeof buildVersionSet>) => {
  if (result.status !== 'found') throw new Error(`expected a version set, got ${result.status}`);
  return result.set;
};
const chosen = (result: ReturnType<typeof buildVersionSet>) =>
  Object.fromEntries(found(result).versions.map((v) => [v.name, v.version]));

const prerelease = (base: PackageVersion, version: string, range: string): PackageVersion => ({
  ...base,
  version,
  isPrerelease: true,
  coreRanges: { ...base.coreRanges, 'geostyler-style': { source: 'declared', range } },
});

describe('buildVersionSet', () => {
  it('keeps geostyler 18.6.0 with mapbox 6.2.0 through the shipped-together rule', () => {
    const result = buildVersionSet(packages, ['geostyler', 'geostyler-sld-parser', 'geostyler-mapbox-parser']);
    expect(chosen(result)).toEqual({
      geostyler: '18.6.0',
      'geostyler-sld-parser': '8.5.0',
      'geostyler-mapbox-parser': '6.2.0',
    });
    const set = found(result);
    expect(set.anchors['geostyler-style']?.version).toBe('11.1.0');

    const pair = (a: string, b: string) =>
      set.pairs.find((p) => [p.a.name, p.b.name].sort().join() === [a, b].sort().join());
    expect(pair('geostyler', 'geostyler-mapbox-parser')?.verdict).toBe('shipped-together');
    // Two parsers geostyler declares in satisfied ranges are shipped together through it.
    const parsers = pair('geostyler-sld-parser', 'geostyler-mapbox-parser');
    expect(parsers?.evaluation.verdict).toBe('risk');
    expect(parsers?.verdict).toBe('shipped-together');
    expect(parsers?.via?.name).toBe('geostyler');
    expect(stackPairSentence(parsers!)).toBe(
      'Different geostyler-style ranges, but geostyler 18.6.0 declares both, so upstream ships them together.',
    );
  });

  it('agrees two data parsers on a geostyler-data anchor', () => {
    const result = buildVersionSet(packages, ['geostyler-geojson-parser', 'geostyler-wfs-parser']);
    expect(chosen(result)).toEqual({ 'geostyler-geojson-parser': '2.0.0', 'geostyler-wfs-parser': '3.0.1' });
    expect(found(result).anchors['geostyler-data']?.version).toBe('1.1.0');
    expect(found(result).pairs[0].verdict).toBe('compatible');
  });

  it('lowers the geostyler-data anchor when a data parser needs it', () => {
    const oldGeojson = fxPackage('geostyler-geojson-parser', '1.0.0');
    const result = buildVersionSet([style, data, oldGeojson, wfs], ['geostyler-geojson-parser', 'geostyler-wfs-parser']);
    expect(chosen(result)).toEqual({ 'geostyler-geojson-parser': '1.0.0', 'geostyler-wfs-parser': '3.0.1' });
    expect(found(result).anchors['geostyler-data']?.version).toBe('1.0.0');
    expect(found(result).anchors['geostyler-style']).toBeUndefined();
  });

  it('builds a parsers-only set without a UI package', () => {
    const result = buildVersionSet(packages, ['geostyler-sld-parser', 'geostyler-openlayers-parser']);
    expect(chosen(result)).toEqual({ 'geostyler-sld-parser': '8.4.2', 'geostyler-openlayers-parser': '5.7.1' });
    expect(found(result).anchors['geostyler-style']?.version).toBe('11.1.0');
  });

  it('falls back to an older anchor when the newest parsers disagree', () => {
    const result = buildVersionSet(packages, ['geostyler-sld-parser', 'geostyler-qgis-parser']);
    expect(chosen(result)).toEqual({ 'geostyler-sld-parser': '8.2.0', 'geostyler-qgis-parser': '4.1.0' });
    expect(found(result).anchors['geostyler-style']?.version).toBe('10.5.0');
  });

  it('takes the newest of each when every pair is Independent', () => {
    const result = buildVersionSet(packages, ['geostyler-sld-parser', 'geostyler-geojson-parser']);
    expect(chosen(result)).toEqual({ 'geostyler-sld-parser': '9.0.3', 'geostyler-geojson-parser': '2.0.0' });
    expect(found(result).pairs[0].verdict).toBe('independent');
  });

  it('gives a core package in the stack the anchor version', () => {
    const result = buildVersionSet(packages, ['geostyler-style', 'geostyler-sld-parser']);
    expect(chosen(result)).toEqual({ 'geostyler-style': '12.0.0', 'geostyler-sld-parser': '9.0.3' });
  });

  it('never chooses a prerelease while a stable version exists', () => {
    const next = prerelease(fx('geostyler-sld-parser', '9.0.3'), '10.0.0-next.1', '^13.0.0');
    const sldWithNext: Package = { ...sld, versions: [next, ...sld.versions] };
    const result = buildVersionSet([style, data, sldWithNext, geojson], ['geostyler-sld-parser', 'geostyler-geojson-parser']);
    expect(chosen(result)['geostyler-sld-parser']).toBe('9.0.3');
  });

  it('uses prereleases for a package that has no stable version', () => {
    const next = prerelease(fx('geostyler-sld-parser', '9.0.3'), '10.0.0-next.1', '^13.0.0');
    const onlyNext: Package = { ...sld, versions: [next] };
    const result = buildVersionSet([style, data, onlyNext, geojson], ['geostyler-sld-parser', 'geostyler-geojson-parser']);
    expect(chosen(result)['geostyler-sld-parser']).toBe('10.0.0-next.1');
  });

  it('reports none when no anchor accepts every package', () => {
    const onlyOld = fxPackage('geostyler-openlayers-parser', '4.1.2');
    const result = buildVersionSet([style, data, sld, onlyOld], ['geostyler-sld-parser', 'geostyler-openlayers-parser']);
    expect(result.status).toBe('none');
  });

  it('lists the newest available version next to each chosen one', () => {
    const result = buildVersionSet(packages, ['geostyler-sld-parser', 'geostyler-qgis-parser']);
    expect(found(result).versions.map((v) => v.version)).toEqual(['8.2.0', '4.1.0']);
    expect(found(result).newest.map((v) => v.version)).toEqual(['9.0.3', '4.1.0']);
  });
});
