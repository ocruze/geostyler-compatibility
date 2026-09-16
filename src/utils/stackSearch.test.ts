import { describe, it, expect } from 'vitest';
import { encodeStackSearch, parsePins, parseStack, parseStackSelection, validateStackSearch } from '@/utils/stackSearch';

describe('stack search', () => {
  it('keeps only tracked packages in the stack', () => {
    expect(parseStack('geostyler,unknown,geostyler-sld-parser', ['geostyler', 'geostyler-sld-parser'])).toEqual([
      'geostyler', 'geostyler-sld-parser',
    ]);
    expect(parseStack(undefined, ['geostyler'])).toEqual([]);
  });

  it('reads name@version pins for stack packages only', () => {
    expect(parsePins('geostyler-sld-parser@9.0.3,geostyler@18.6.0,broken', ['geostyler-sld-parser'])).toEqual({
      'geostyler-sld-parser': '9.0.3',
    });
  });

  it('round-trips through the URL and leaves empty parameters out', () => {
    const search = encodeStackSearch({ stack: ['geostyler', 'geostyler-sld-parser'], pins: { 'geostyler-sld-parser': '9.0.3', other: '1' } });
    expect(search).toEqual({ stack: 'geostyler,geostyler-sld-parser', pin: 'geostyler-sld-parser@9.0.3' });
    expect(encodeStackSearch({ stack: [], pins: {} })).toEqual({});
    expect(parseStackSelection(search, ['geostyler', 'geostyler-sld-parser'])).toEqual({
      stack: ['geostyler', 'geostyler-sld-parser'],
      pins: { 'geostyler-sld-parser': '9.0.3' },
    });
    expect(validateStackSearch({ stack: '', pin: 5 })).toEqual({ stack: undefined, pin: undefined });
  });
});
