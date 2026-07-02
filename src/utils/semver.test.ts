import { describe, it, expect } from 'vitest';
import { satisfies, intersectRanges, rangesOverlap, compareVersions, formatRangeForDisplay } from '@/utils/semver';

describe('test harness', () => {
  it('runs', () => {
    expect(satisfies('1.2.3', '^1.0.0')).toBe(true);
  });
});

describe('intersectRanges', () => {
  it('returns the shared range for identical carets', () => {
    expect(intersectRanges(['^12.0.0', '^12.0.0'])).toBe('^12.0.0');
  });

  it('returns null for disjoint major carets', () => {
    expect(intersectRanges(['^11.0.0', '^12.0.0'])).toBeNull();
  });

  it('handles minors greater than 10 (old sampling bug)', () => {
    expect(intersectRanges(['^0.15.0', '^0.15.0'])).toBe('^0.15.0');
  });

  it('handles non-.0 patch-only overlaps (old sampling bug)', () => {
    const r = intersectRanges(['>=1.2.3 <1.2.9', '>=1.2.4 <1.2.8']);
    expect(r).not.toBeNull();
    expect(satisfies('1.2.5', r as string)).toBe(true);
  });

  it('narrows to the more restrictive of two overlapping ranges', () => {
    const r = intersectRanges(['^1.0.0', '~1.2.0']);
    expect(r).not.toBeNull();
    expect(satisfies('1.2.5', r as string)).toBe(true);
    expect(satisfies('1.1.0', r as string)).toBe(false);
  });

  it('returns null for all-invalid input', () => {
    expect(intersectRanges(['not-a-range', ''])).toBeNull();
  });
});

describe('rangesOverlap', () => {
  it('true when ranges share versions', () => {
    expect(rangesOverlap('^1.0.0', '~1.2.0')).toBe(true);
  });
  it('false when disjoint', () => {
    expect(rangesOverlap('^11.0.0', '^12.0.0')).toBe(false);
  });
});

describe('formatRangeForDisplay', () => {
  it('strips -0 prerelease sentinels', () => {
    expect(formatRangeForDisplay('>=10.5.0 <11.0.0-0')).toBe('>=10.5.0 <11.0.0');
  });

  it('drops redundant lower bounds, keeping the highest', () => {
    expect(formatRangeForDisplay('>=10.5.0 <11.0.0-0 >=10.4.0')).toBe('>=10.5.0 <11.0.0');
  });

  it('leaves simple ranges untouched', () => {
    expect(formatRangeForDisplay('^11.0.0')).toBe('^11.0.0');
  });
});

describe('compareVersions', () => {
  it('orders valid versions', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });
  it('throws on invalid input rather than reporting equal', () => {
    expect(() => compareVersions('nope', '1.0.0')).toThrow();
  });
});
