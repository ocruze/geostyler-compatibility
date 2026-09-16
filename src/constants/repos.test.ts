import { describe, it, expect } from 'vitest';
import { TRACKED_PACKAGES } from './repos';

describe('tracked packages', () => {
  it('tracks twelve packages and not geostyler-cql-parser', () => {
    expect(TRACKED_PACKAGES).toHaveLength(12);
    expect(TRACKED_PACKAGES).not.toContain('geostyler-cql-parser');
  });
});
