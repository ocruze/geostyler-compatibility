import { describe, it, expect } from 'vitest';
import { buildLatestReleasesGrid, latestStableVersion } from '@/engine/latestReleasesGrid';
import type { Package, PackageVersion } from '@/types/compatibility';
import fixture from './__fixtures__/versions.json';

const records = fixture as PackageVersion[];
const fx = (name: string, version: string): PackageVersion => {
  const record = records.find((r) => r.name === name && r.version === version);
  if (!record) throw new Error(`fixture missing ${name}@${version}`);
  return record;
};

// Versions newest-first, as in the dataset.
const pkg = (name: string, versions: PackageVersion[], category: Package['category']): Package => ({
  name, category, versions, latestVersion: versions[0].version, repositoryUrl: '',
});

const prerelease = (base: PackageVersion, version: string): PackageVersion => ({ ...base, version, isPrerelease: true });

describe('latestStableVersion', () => {
  it('skips prereleases', () => {
    const stable = fx('geostyler-style', '13.0.0');
    const p = pkg('geostyler-style', [prerelease(stable, '14.0.0-next.1'), stable], 'core');
    expect(latestStableVersion(p)?.version).toBe('13.0.0');
  });

  it('falls back to the newest prerelease when no stable version exists', () => {
    const base = fx('geostyler-style', '13.0.0');
    const p = pkg('geostyler-style', [prerelease(base, '14.0.0-next.2'), prerelease(base, '14.0.0-next.1')], 'core');
    expect(latestStableVersion(p)?.version).toBe('14.0.0-next.2');
  });
});

describe('buildLatestReleasesGrid', () => {
  const packages = [
    pkg('geostyler-style', [fx('geostyler-style', '13.0.0'), fx('geostyler-style', '12.0.0')], 'core'),
    pkg('geostyler', [fx('geostyler', '18.6.0')], 'ui'),
    pkg('geostyler-mapbox-parser', [fx('geostyler-mapbox-parser', '6.2.0')], 'style-parser'),
    pkg('geostyler-geojson-parser', [fx('geostyler-geojson-parser', '2.0.0')], 'data-parser'),
  ];

  it('keeps the tracked order and evaluates every pair once per cell', () => {
    const grid = buildLatestReleasesGrid(packages);
    expect(grid.versions.map((v) => `${v.name}@${v.version}`)).toEqual([
      'geostyler-style@13.0.0', 'geostyler@18.6.0', 'geostyler-mapbox-parser@6.2.0', 'geostyler-geojson-parser@2.0.0',
    ]);
    expect(grid.cells).toHaveLength(4);
    expect(grid.cells[0]).toHaveLength(4);
    expect(grid.cells[0][0]).toBeNull();
    expect(grid.cells[1][2]?.verdict).toBe('shipped-together');
    expect(grid.cells[2][1]?.verdict).toBe('shipped-together');
    expect(grid.cells[2][3]?.verdict).toBe('independent');
    expect(grid.cells[0][2]?.verdict).toBe('risk');
  });
});
