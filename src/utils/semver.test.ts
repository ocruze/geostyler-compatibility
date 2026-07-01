import { describe, it, expect } from 'vitest';
import { satisfies } from '@/utils/semver';

describe('test harness', () => {
  it('runs', () => {
    expect(satisfies('1.2.3', '^1.0.0')).toBe(true);
  });
});
