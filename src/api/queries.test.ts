import { describe, it, expect } from 'vitest';
import { checkVersionCompatibility, findRecommendedSet } from '@/api/queries';
import type { Package, PackageVersion } from '@/types/compatibility';

const v = (over: Partial<PackageVersion>): PackageVersion => ({
  name: 'x', version: '1.0.0', category: 'style-parser',
  dependencies: {}, peerDependencies: {}, esmSupport: true,
  publishDate: '2024-01-01', isPrerelease: false,
  repositoryUrl: '', npmUrl: '', ...over,
});

// versions are given newest-first, matching the dataset ordering
const pkg = (name: string, versions: Partial<PackageVersion>[], category: Package['category'] = 'style-parser'): Package => ({
  name,
  category,
  versions: versions.map((over) => v({ name, category, ...over })),
  latestVersion: versions[0]?.version ?? '0.0.0',
  repositoryUrl: '',
});

describe('checkVersionCompatibility', () => {
  it('incompatible when geostyler-style ranges are disjoint', () => {
    const r = checkVersionCompatibility(
      v({ name: 'a', geostylerStyleRange: '^11.0.0' }),
      v({ name: 'b', geostylerStyleRange: '^12.0.0' }),
    );
    expect(r.compatible).toBe(false);
  });

  it('flags peer-dep conflict (either direction)', () => {
    const r = checkVersionCompatibility(
      v({ name: 'a', version: '1.0.0', peerDependencies: { b: '^2.0.0' } }),
      v({ name: 'b', version: '1.0.0' }),
    );
    expect(r.compatible).toBe(false);
    expect(r.reason).toMatch(/peer/i);
  });

  it('warns (not fails) on ESM/CJS mismatch', () => {
    const r = checkVersionCompatibility(
      v({ name: 'a', esmSupport: true }),
      v({ name: 'b', esmSupport: false }),
    );
    expect(r.compatible).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('findRecommendedSet', () => {
  const gsStyle = pkg('geostyler-style', [
    { version: '12.0.0' },
    { version: '10.6.0' },
    { version: '10.0.0' },
  ], 'core');

  it('finds the newest mutually-compatible set across ranges', () => {
    const a = pkg('parser-a', [
      { version: '2.0.0', geostylerStyleRange: '^12.0.0' },
      { version: '1.5.0', geostylerStyleRange: '^10.0.0' },
    ]);
    const b = pkg('parser-b', [
      { version: '3.0.0', geostylerStyleRange: '^10.5.0' },
    ]);
    const result = findRecommendedSet(['parser-a', 'parser-b'], [gsStyle, a, b]);
    expect(result).not.toBeNull();
    // gs 12.0.0 fails (b has no match); gs 10.6.0 works with a@1.5.0 + b@3.0.0
    expect(result!.gsVersion).toBe('10.6.0');
    expect(result!.versions).toEqual([
      { name: 'parser-a', version: '1.5.0' },
      { name: 'parser-b', version: '3.0.0' },
    ]);
  });

  it('returns null when no geostyler-style version satisfies all packages', () => {
    const a = pkg('parser-a', [{ version: '2.0.0', geostylerStyleRange: '^12.0.0' }]);
    const b = pkg('parser-b', [{ version: '3.0.0', geostylerStyleRange: '^10.0.0' }]);
    expect(findRecommendedSet(['parser-a', 'parser-b'], [gsStyle, a, b])).toBeNull();
  });

  it('skips prerelease versions when stable ones exist', () => {
    const a = pkg('parser-a', [
      { version: '3.0.0-next.1', geostylerStyleRange: '^12.0.0', isPrerelease: true },
      { version: '2.0.0', geostylerStyleRange: '^12.0.0' },
    ]);
    const b = pkg('parser-b', [{ version: '1.0.0', geostylerStyleRange: '^12.0.0' }]);
    const result = findRecommendedSet(['parser-a', 'parser-b'], [gsStyle, a, b]);
    expect(result!.versions[0]).toEqual({ name: 'parser-a', version: '2.0.0' });
  });

  it('uses latest stable versions when no package has a geostyler-style range', () => {
    const a = pkg('data-a', [{ version: '2.0.0' }], 'data-parser');
    const b = pkg('data-b', [{ version: '1.1.0' }], 'data-parser');
    const result = findRecommendedSet(['data-a', 'data-b'], [gsStyle, a, b]);
    expect(result).not.toBeNull();
    expect(result!.gsVersion).toBeNull();
    expect(result!.versions).toEqual([
      { name: 'data-a', version: '2.0.0' },
      { name: 'data-b', version: '1.1.0' },
    ]);
  });

  it('anchors geostyler-style itself when selected', () => {
    const a = pkg('parser-a', [
      { version: '2.0.0', geostylerStyleRange: '^12.0.0' },
      { version: '1.5.0', geostylerStyleRange: '^10.0.0' },
    ]);
    const result = findRecommendedSet(['geostyler-style', 'parser-a'], [gsStyle, a]);
    expect(result!.gsVersion).toBe('12.0.0');
    expect(result!.versions).toEqual([
      { name: 'geostyler-style', version: '12.0.0' },
      { name: 'parser-a', version: '2.0.0' },
    ]);
  });

  it('rejects sets with peer-dependency conflicts and keeps searching', () => {
    const a = pkg('parser-a', [{ version: '2.0.0', geostylerStyleRange: '^12.0.0', peerDependencies: { 'parser-b': '^9.0.0' } }]);
    const b = pkg('parser-b', [{ version: '1.0.0', geostylerStyleRange: '^12.0.0' }]);
    expect(findRecommendedSet(['parser-a', 'parser-b'], [gsStyle, a, b])).toBeNull();
  });

  it('surfaces ESM/CJS mixes as warnings, not failures', () => {
    const a = pkg('data-a', [{ version: '2.0.0', esmSupport: true }], 'data-parser');
    const b = pkg('data-b', [{ version: '1.0.0', esmSupport: false }], 'data-parser');
    const result = findRecommendedSet(['data-a', 'data-b'], [gsStyle, a, b]);
    expect(result).not.toBeNull();
    expect(result!.warnings.length).toBeGreaterThan(0);
  });

  it('returns null for unknown package names', () => {
    expect(findRecommendedSet(['nope', 'also-nope'], [gsStyle])).toBeNull();
  });
});
