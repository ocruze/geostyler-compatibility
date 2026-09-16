import { describe, it, expect } from 'vitest';
import { formatUtcDate } from '@/utils/date';

describe('formatUtcDate', () => {
  it('returns the UTC calendar day of an ISO timestamp', () => {
    expect(formatUtcDate('2026-09-16T23:30:00.000Z')).toBe('2026-09-16');
  });

  it('uses the UTC day, not the local one, for offset timestamps', () => {
    expect(formatUtcDate('2026-09-16T23:30:00+02:00')).toBe('2026-09-16');
    expect(formatUtcDate('2026-09-17T01:30:00+02:00')).toBe('2026-09-16');
  });

  it('returns null for an empty or unparseable value', () => {
    expect(formatUtcDate('')).toBeNull();
    expect(formatUtcDate('not a date')).toBeNull();
  });
});
