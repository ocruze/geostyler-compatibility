#!/usr/bin/env tsx

/**
 * Fetches package metadata from the npm registry (serial, rate-limited).
 * Generates src/data/packages.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { REPOS, REPO_TO_NPM, NPM_TO_REPO, TRACKED_PACKAGES, CORE_PACKAGES } from '../src/constants/repos.js';
import type {
  Dataset,
  Package,
  PackageVersion,
  PackageCategory,
  StyleFormat,
  DataFormat,
  CorePackage,
  CoreRange,
  CoreRanges,
  ModuleSystem,
} from '../src/types/compatibility.js';
import * as semver from 'semver';
import { ProxyAgent } from 'undici';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../src/data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'packages.json');

// Rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function getProxyAgent(targetUrl: string): ProxyAgent | undefined {
  const proxyUrl = targetUrl.startsWith('https:')
    ? (process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY)
    : process.env.HTTP_PROXY;

  if (!proxyUrl) return undefined;
  return new ProxyAgent(proxyUrl);
}

/**
 * Fetch from npm registry
 */
async function fetchNpmPackage(packageName: string): Promise<unknown> {
  const url = `https://registry.npmjs.org/${packageName}`;
  console.log(`Fetching npm: ${packageName}`);
  
  try {
    const proxyAgent = getProxyAgent(url);
    const response = await fetch(
      url,
      proxyAgent ? ({ dispatcher: proxyAgent } as RequestInit) : undefined
    );
    if (!response.ok) {
      throw new Error(`npm registry returned ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${packageName} from npm:`, error);
    return null;
  }
}

/**
 * Determine package category from repo name
 */
function getPackageCategory(repoName: string): PackageCategory {
  const name = repoName.toLowerCase();
  
  if (name.includes('geostyler-style')) return 'core';
  if (name.includes('geostyler-data')) return 'core';
  if (name === 'geostyler/geostyler' || name.includes('legend')) return 'ui';
  if (name.includes('geojson') || name.includes('wfs') || name.includes('shapefile')) return 'data-parser';
  if (name.includes('parser')) return 'style-parser';
  
  return 'style-parser'; // default
}

/**
 * Extract format from package name
 */
function extractFormat(packageName: string): string | undefined {
  const formatMap: Record<string, string> = {
    'sld-parser': 'SLD',
    'mapbox-parser': 'Mapbox GL v8',
    'qgis-parser': 'QGIS',
    'openlayers-parser': 'OpenLayers',
    'lyrx-parser': 'LYRX',
    'geojson-parser': 'GeoJSON',
    'wfs-parser': 'WFS',
    'shapefile-parser': 'Shapefile',
  };
  
  for (const [key, value] of Object.entries(formatMap)) {
    if (packageName.includes(key)) return value;
  }
  
  return undefined;
}

/**
 * Detect ESM support from the version's package.json metadata.
 * Prefers ground truth over version-number guessing.
 */
export function detectEsmSupport(versionData: Record<string, unknown>): boolean {
  if (versionData?.type === 'module') return true;
  if (versionData?.module) return true;
  const exp = versionData?.exports;
  const hasImport = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false;
    if ('import' in (node as Record<string, unknown>)) return true;
    return Object.values(node as Record<string, unknown>).some(hasImport);
  };
  return hasImport(exp);
}

const isDeclarationFile = (entry: unknown): boolean =>
  typeof entry === 'string' && entry.endsWith('.d.ts');

/**
 * Types-only when the main or types entry is a declaration file and no JavaScript entry exists.
 */
export function detectModuleSystem(versionData: Record<string, unknown>): ModuleSystem {
  const hasJsMain = typeof versionData.main === 'string' && !isDeclarationFile(versionData.main);
  const hasOtherJsEntry = Boolean(versionData.module || versionData.exports || versionData.browser);
  const hasDeclarationEntry = isDeclarationFile(versionData.main) || isDeclarationFile(versionData.types);
  if (hasDeclarationEntry && !hasJsMain && !hasOtherJsEntry) return 'types-only';
  return detectEsmSupport(versionData) ? 'esm' : 'cjs';
}

function extractDeclaredDependencies(dependencies: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dependencies).filter(([name]) => TRACKED_PACKAGES.includes(name)),
  );
}

/**
 * The range a version declares on each core package, in dependencies or peerDependencies.
 */
function extractCoreRanges(versionData: NpmVersionData): CoreRanges {
  return Object.fromEntries(
    CORE_PACKAGES.map((core) => {
      const range = versionData.dependencies?.[core] ?? versionData.peerDependencies?.[core];
      return [core, range ? { source: 'declared', range } : { source: 'none' }];
    }),
  ) as CoreRanges;
}

/**
 * Minimal shape of a single version entry within the npm registry package
 * metadata response. Only documents the fields actually read below —
 * detectEsmSupport takes the broader Record<string, unknown> shape since it
 * probes fields (type/module/exports) not otherwise needed here.
 */
interface NpmVersionData extends Record<string, unknown> {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Minimal shape of the npm registry package metadata response that
 * processNpmData relies on. The registry response has many more fields;
 * this only documents what's actually read below.
 */
interface NpmRegistryPackage {
  versions?: Record<string, NpmVersionData>;
  time?: Record<string, string>;
  'dist-tags'?: Record<string, string>;
}

/**
 * Turn one npm registry response into a Package record. Pure: no I/O.
 */
export function processNpmData(npmData: NpmRegistryPackage, npmPackageName: string): Package {
  const repoName = NPM_TO_REPO[npmPackageName];
  if (!repoName) throw new Error(`${npmPackageName} is not a tracked package`);
  const category = getPackageCategory(repoName);
  const format = extractFormat(npmPackageName);
  
  const versions: PackageVersion[] = [];
  const versionsByTag = npmData.versions || {};
  const allVersions = Object.keys(versionsByTag);

  // Process each version
  for (const versionTag of allVersions) {
    const versionData = versionsByTag[versionTag];

    // Skip invalid versions
    if (!semver.valid(versionTag)) continue;

    const coreRanges = extractCoreRanges(versionData);
    const styleRange = coreRanges['geostyler-style'];

    const packageVersion: PackageVersion = {
      name: npmPackageName,
      version: versionTag,
      category,
      dependencies: versionData.dependencies || {},
      peerDependencies: versionData.peerDependencies || {},
      coreRanges,
      declaredDependencies: extractDeclaredDependencies(versionData.dependencies),
      moduleSystem: detectModuleSystem(versionData),
      geostylerStyleRange: styleRange.source === 'declared' ? styleRange.range : undefined,
      esmSupport: detectEsmSupport(versionData),
      publishDate: npmData.time?.[versionTag] ?? '',
      isPrerelease: semver.prerelease(versionTag) !== null,
      repositoryUrl: `https://github.com/${repoName}`,
      changelogUrl: `https://github.com/${repoName}/blob/main/CHANGELOG.md`,
      npmUrl: `https://www.npmjs.com/package/${npmPackageName}/v/${versionTag}`,
    };
    
    versions.push(packageVersion);
  }
  
  // Sort versions by semver
  versions.sort((a, b) => semver.rcompare(a.version, b.version));
  
  const latestVersion = npmData['dist-tags']?.latest || versions[0]?.version || '0.0.0';
  
  return {
    name: npmPackageName,
    category,
    // extractFormat's map values (e.g. 'SLD') don't exactly match the
    // StyleFormat/DataFormat unions (e.g. 'SLD 1.0.0' | 'SLD 1.1.0') — this
    // cast preserves pre-existing behavior without using `any`.
    format: format as StyleFormat | DataFormat | undefined,
    versions,
    latestVersion,
    repositoryUrl: `https://github.com/${repoName}`,
  };
}

/**
 * A version with no core range inherits one through its declared dependencies on tracked
 * packages: newest version satisfying the declared range, repeated until a declared range is
 * found or the chain ends. Pure: returns new records, resolved within `packages` only.
 */
export function resolveTransitiveCoreRanges(packages: Package[]): Package[] {
  const byName = new Map(packages.map((pkg) => [pkg.name, pkg]));

  const newestSatisfying = (name: string, range: string): PackageVersion | undefined =>
    byName.get(name)?.versions.find((v) => semver.satisfies(v.version, range));

  const resolve = (version: PackageVersion, core: CorePackage, visited: Set<string>): CoreRange => {
    const own = version.coreRanges[core];
    if (own.source === 'declared') return { source: 'transitive', range: own.range, origin: { name: version.name, version: version.version } };
    const key = `${version.name}@${version.version}`;
    if (visited.has(key)) return { source: 'none' };
    visited.add(key);
    for (const [name, range] of Object.entries(version.declaredDependencies).sort()) {
      if (CORE_PACKAGES.includes(name as CorePackage)) continue;
      const dependency = newestSatisfying(name, range);
      if (!dependency) continue;
      const found = resolve(dependency, core, visited);
      if (found.source !== 'none') return found;
    }
    return { source: 'none' };
  };

  return packages.map((pkg) => ({
    ...pkg,
    versions: pkg.versions.map((version) => ({
      ...version,
      coreRanges: Object.fromEntries(
        CORE_PACKAGES.map((core) => {
          const own = version.coreRanges[core];
          return [core, own.source === 'none' ? resolve(version, core, new Set()) : own];
        }),
      ) as CoreRanges,
    })),
  }));
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting metadata fetch...');
  
  const packages: Package[] = [];
  const failures: string[] = [];

  for (const repo of REPOS) {
    const npmPackageName = REPO_TO_NPM[repo];

    console.log(`\n--- Processing ${repo} ---`);

    // Fetch from the npm registry
    const npmData = await fetchNpmPackage(npmPackageName);

    if (!npmData) {
      console.error(`Skipping ${repo} - no npm data`);
      failures.push(repo);
      continue;
    }
    
    const packageData = processNpmData(npmData as NpmRegistryPackage, npmPackageName);
    packages.push(packageData);
    
    console.log(`  ✓ Processed ${packageData.versions.length} versions`);
    
    // Rate limiting: wait between requests
    await delay(100);
  }
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Write output
  const dataset: Dataset = { generatedAt: new Date().toISOString(), packages: resolveTransitiveCoreRanges(packages) };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
  
  console.log(`\n✓ Successfully wrote ${packages.length} packages to ${OUTPUT_FILE}`);
  console.log(`Total versions: ${packages.reduce((sum, pkg) => sum + pkg.versions.length, 0)}`);

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} package(s) failed to fetch: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

// Only run main() when this file is executed directly (e.g. `tsx scripts/fetch-metadata.ts`),
// not when it's merely imported by tests.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
