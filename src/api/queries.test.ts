import { describe, it, expect } from 'vitest';
import { checkVersionCompatibility } from '@/api/queries';
import type { PackageVersion } from '@/types/compatibility';

const v = (over: Partial<PackageVersion>): PackageVersion => ({
  name: 'x', version: '1.0.0', category: 'style-parser',
  dependencies: {}, peerDependencies: {}, esmSupport: true,
  publishDate: '2024-01-01', isPrerelease: false,
  repositoryUrl: '', npmUrl: '', ...over,
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
