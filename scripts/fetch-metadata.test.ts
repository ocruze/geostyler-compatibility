import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectEsmSupport, detectModuleSystem, processNpmData } from './fetch-metadata';

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__/registry');

// Recorded npm registry responses, trimmed to a few versions each.
const registry = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(fixturesDir, `${name}.json`), 'utf8'));

const versionOf = (name: string, version: string) => {
  const found = processNpmData(registry(name), name).versions.find((v) => v.version === version);
  if (!found) throw new Error(`${name}@${version} missing from fixture`);
  return found;
};

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

describe('detectModuleSystem', () => {
  it('cjs when the only entry is a JavaScript main', () => {
    expect(detectModuleSystem({ main: './index.js' })).toBe('cjs');
  });
  it('esm when type=module', () => {
    expect(detectModuleSystem({ main: './index.js', type: 'module' })).toBe('esm');
  });
  it('types-only when main is a declaration file and nothing else is an entry', () => {
    expect(detectModuleSystem({ main: 'index.d.ts' })).toBe('types-only');
  });
  it('types-only when only a types entry exists', () => {
    expect(detectModuleSystem({ types: 'index.d.ts' })).toBe('types-only');
  });
  it('not types-only when a declaration main sits next to a module entry', () => {
    expect(detectModuleSystem({ main: 'index.d.ts', module: './index.mjs' })).toBe('esm');
  });
});

describe('processNpmData', () => {
  it('flags geostyler-data versions that ship only declarations as types-only', () => {
    expect(versionOf('geostyler-data', '0.5.3').moduleSystem).toBe('types-only');
    expect(versionOf('geostyler-data', '1.1.0').moduleSystem).toBe('types-only');
    expect(versionOf('geostyler-legend', '5.2.0').moduleSystem).toBe('esm');
  });

  it('keeps declared dependencies on tracked packages only', () => {
    expect(versionOf('geostyler-legend', '5.2.0').declaredDependencies).toEqual({
      'geostyler-openlayers-parser': '5.1.2',
    });
    const ui = versionOf('geostyler', '18.6.0').declaredDependencies;
    expect(ui['geostyler-mapbox-parser']).toBe('^6.1.1');
    expect(ui['geostyler-style']).toBe('^11.1.0');
    expect(ui).not.toHaveProperty('antd');
    expect(ui).not.toHaveProperty('geostyler-cql-parser');
  });

  it('keeps peer dependencies with their ranges', () => {
    expect(versionOf('geostyler-legend', '5.2.0').peerDependencies).toEqual({ d3: '>=6', ol: '>=6' });
  });

  it('flags prereleases', () => {
    expect(versionOf('geostyler', '15.0.0-beta.5').isPrerelease).toBe(true);
    expect(versionOf('geostyler-data', '0.5.2-0').isPrerelease).toBe(true);
    expect(versionOf('geostyler', '18.6.0').isPrerelease).toBe(false);
  });

  it('records a declared core range per core package', () => {
    expect(versionOf('geostyler', '18.6.0').coreRanges).toEqual({
      'geostyler-style': { source: 'declared', range: '^11.1.0' },
      'geostyler-data': { source: 'declared', range: '^1.1.0' },
    });
  });

  it('records source none when a version declares no core range', () => {
    expect(versionOf('geostyler-legend', '5.2.0').coreRanges).toEqual({
      'geostyler-style': { source: 'none' },
      'geostyler-data': { source: 'none' },
    });
    expect(versionOf('geostyler-style', '13.0.0').coreRanges['geostyler-style']).toEqual({ source: 'none' });
  });

  it('keeps the existing package-level fields', () => {
    const pkg = processNpmData(registry('geostyler-legend'), 'geostyler-legend');
    expect(pkg.category).toBe('ui');
    expect(pkg.latestVersion).toBe('5.2.1');
    expect(pkg.repositoryUrl).toBe('https://github.com/geostyler/geostyler-legend');
    expect(pkg.versions.map((v) => v.version)).toEqual(['5.2.1', '5.2.0']);
  });
});
