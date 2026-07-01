#!/usr/bin/env tsx

/**
 * Fetches package metadata from the npm registry (serial, rate-limited).
 * Generates src/data/packages.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { REPOS, REPO_TO_NPM } from '../src/constants/repos.js';
import type { Package, PackageVersion, PackageCategory } from '../src/types/compatibility.js';
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
async function fetchNpmPackage(packageName: string): Promise<any> {
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
    'geocss-parser': 'GeoCss',
    'symcore-parser': 'SymCore',
    'masterportal-parser': 'Masterportal',
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

/**
 * Process npm package data into our format
 */
function processNpmData(npmData: any, repoName: string): Package {
  const npmPackageName = REPO_TO_NPM[repoName];
  const category = getPackageCategory(repoName);
  const format = extractFormat(npmPackageName);
  
  const versions: PackageVersion[] = [];
  const allVersions = Object.keys(npmData.versions || {});
  
  // Process each version
  for (const versionTag of allVersions) {
    const versionData = npmData.versions[versionTag];
    
    // Skip invalid versions
    if (!semver.valid(versionTag)) continue;
    
    const packageVersion: PackageVersion = {
      name: npmPackageName,
      version: versionTag,
      category,
      dependencies: versionData.dependencies || {},
      peerDependencies: versionData.peerDependencies || {},
      geostylerStyleRange:
        versionData.dependencies?.['geostyler-style'] ||
        versionData.peerDependencies?.['geostyler-style'],
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
    format: format as any,
    versions,
    latestVersion,
    repositoryUrl: `https://github.com/${repoName}`,
  };
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
    
    const packageData = processNpmData(npmData, repo);
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
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(packages, null, 2));
  
  console.log(`\n✓ Successfully wrote ${packages.length} packages to ${OUTPUT_FILE}`);
  console.log(`Total versions: ${packages.reduce((sum, pkg) => sum + pkg.versions.length, 0)}`);

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} package(s) failed to fetch: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
}

// Only run main() when this file is executed directly (e.g. `tsx scripts/fetch-metadata.ts`),
// not when it's merely imported (e.g. by tests importing `detectEsmSupport`).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
