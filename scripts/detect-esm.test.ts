import { describe, it, expect } from 'vitest';
import { detectEsmSupport } from './fetch-metadata';

describe('detectEsmSupport', () => {
  it('true when type=module', () => {
    expect(detectEsmSupport({ type: 'module' })).toBe(true);
  });
  it('true when exports has an import condition', () => {
    expect(detectEsmSupport({ exports: { '.': { import: './x.js' } } })).toBe(true);
  });
  it('true when a module field is present', () => {
    expect(detectEsmSupport({ module: './x.mjs' })).toBe(true);
  });
  it('false for classic CJS (main only, no type)', () => {
    expect(detectEsmSupport({ main: './index.js' })).toBe(false);
  });
});
