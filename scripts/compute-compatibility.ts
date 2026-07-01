#!/usr/bin/env tsx

/**
 * Computes compatibility between packages based on geostyler-style ranges,
 * ESM support, and peer dependencies
 * Generates public/data/compatibility-matrix.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { 
  Package, 
  PackageVersion, 
  CompatibilityCheck, 
  CompatibilityMatrix,
  Conflict,
} from '../src/types/compatibility.js';
import { intersectRanges } from '../src/utils/semver.js';
import * as semver from 'semver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '../src/data/packages.json');
const OUTPUT_FILE = path.join(__dirname, '../src/data/compatibility-matrix.json');

/**
 * Check compatibility between two package versions
 */
function checkPairCompatibility(pkg1: PackageVersion, pkg2: PackageVersion): Conflict[] {
  const conflicts: Conflict[] = [];
  
  // Check geostyler-style range compatibility
  if (pkg1.geostylerStyleRange && pkg2.geostylerStyleRange) {
    const intersection = intersectRanges([pkg1.geostylerStyleRange, pkg2.geostylerStyleRange]);
    
    if (!intersection) {
      conflicts.push({
        reason: 'geostyler-style-mismatch',
        severity: 'error',
        message: `${pkg1.name}@${pkg1.version} requires geostyler-style ${pkg1.geostylerStyleRange}, but ${pkg2.name}@${pkg2.version} requires ${pkg2.geostylerStyleRange}`,
        packages: [`${pkg1.name}@${pkg1.version}`, `${pkg2.name}@${pkg2.version}`],
        details: {
          pkg1Range: pkg1.geostylerStyleRange,
          pkg2Range: pkg2.geostylerStyleRange,
        },
      });
    }
  }
  
  // Check ESM/CJS compatibility
  if (pkg1.esmSupport !== pkg2.esmSupport) {
    conflicts.push({
      reason: 'esm-incompatible',
      severity: 'warning',
      message: `${pkg1.name}@${pkg1.version} is ${pkg1.esmSupport ? 'ESM' : 'CJS'}, but ${pkg2.name}@${pkg2.version} is ${pkg2.esmSupport ? 'ESM' : 'CJS'}`,
      packages: [`${pkg1.name}@${pkg1.version}`, `${pkg2.name}@${pkg2.version}`],
      details: {
        pkg1ESM: pkg1.esmSupport,
        pkg2ESM: pkg2.esmSupport,
      },
    });
  }
  
  // Check peer dependency conflicts in BOTH directions
  const checkPeers = (a: PackageVersion, b: PackageVersion) => {
    for (const [depName, depRange] of Object.entries(a.peerDependencies)) {
      if (b.name !== depName) continue;
      try {
        if (!semver.satisfies(b.version, depRange)) {
          conflicts.push({
            reason: 'peer-dep-conflict',
            severity: 'error',
            message: `${a.name}@${a.version} requires peer ${depName}@${depRange}, but found ${b.version}`,
            packages: [`${a.name}@${a.version}`, `${b.name}@${b.version}`],
            details: { requiredRange: depRange, foundVersion: b.version },
          });
        }
      } catch {
        console.warn(`Invalid peer range ${a.name}@${a.version} -> ${depName}@${depRange}`);
      }
    }
  };
  checkPeers(pkg1, pkg2);
  checkPeers(pkg2, pkg1);

  return conflicts;
}

/**
 * Check compatibility for a set of package versions
 */
function checkSetCompatibility(packages: PackageVersion[]): CompatibilityCheck {
  const conflicts: Conflict[] = [];
  const packageIds = packages.map(pkg => `${pkg.name}@${pkg.version}`);
  
  // Check all pairs
  for (let i = 0; i < packages.length; i++) {
    for (let j = i + 1; j < packages.length; j++) {
      const pairConflicts = checkPairCompatibility(packages[i], packages[j]);
      conflicts.push(...pairConflicts);
    }
  }
  
  // Find shared geostyler-style versions
  const geostylerStyleRanges = packages
    .map(pkg => pkg.geostylerStyleRange)
    .filter((range): range is string => !!range);
  
  const sharedRange = geostylerStyleRanges.length > 0 
    ? intersectRanges(geostylerStyleRanges)
    : null;
  
  // Generate recommendations if conflicts exist
  const recommendations: string[] = [];
  if (conflicts.some(c => c.severity === 'error')) {
    recommendations.push('These packages cannot be used together in their current versions');
    
    if (conflicts.some(c => c.reason === 'geostyler-style-mismatch')) {
      recommendations.push('Try using versions that depend on compatible geostyler-style ranges');
    }
    
    if (conflicts.some(c => c.reason === 'esm-incompatible')) {
      recommendations.push('Ensure all packages use the same module system (ESM or CJS)');
    }
  }
  
  return {
    packages: packageIds,
    compatible: conflicts.filter(c => c.severity === 'error').length === 0,
    conflicts,
    sharedGeostylerStyleVersions: sharedRange ? [sharedRange] : [],
    recommendations: recommendations.length > 0 ? recommendations : undefined,
  };
}

/**
 * Generate compatibility checks for common scenarios
 */
function generateCommonChecks(packages: Package[]): Record<string, CompatibilityCheck> {
  const checks: Record<string, CompatibilityCheck> = {};
  
  console.log('Generating compatibility checks...');
  
  // Get latest versions of each package
  const latestVersions = packages
    .map((pkg) => pkg.versions.find((v) => v.version === pkg.latestVersion))
    .filter((v): v is PackageVersion => !!v && !v.isPrerelease);
  
  // Check all pairs of latest versions
  console.log('  - Checking all latest version pairs...');
  for (let i = 0; i < latestVersions.length; i++) {
    for (let j = i + 1; j < latestVersions.length; j++) {
      const pkg1 = latestVersions[i];
      const pkg2 = latestVersions[j];
      
      const check = checkSetCompatibility([pkg1, pkg2]);
      const key = check.packages.sort().join(',');
      checks[key] = check;
    }
  }
  
  // Check common triplets (UI + 2 parsers, etc.)
  console.log('  - Checking common package combinations...');
  const styleParsers = latestVersions.filter(v => v.category === 'style-parser');
  const uiPackages = latestVersions.filter(v => v.category === 'ui');
  
  for (const ui of uiPackages) {
    for (let i = 0; i < Math.min(styleParsers.length, 3); i++) {
      for (let j = i + 1; j < Math.min(styleParsers.length, 3); j++) {
        const check = checkSetCompatibility([ui, styleParsers[i], styleParsers[j]]);
        const key = check.packages.sort().join(',');
        checks[key] = check;
      }
    }
  }
  
  console.log(`  ✓ Generated ${Object.keys(checks).length} compatibility checks`);
  
  return checks;
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting compatibility computation...');
  
  // Read packages data
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Error: ${INPUT_FILE} not found. Run fetch-metadata first.`);
    process.exit(1);
  }
  
  const packages: Package[] = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Loaded ${packages.length} packages`);
  
  // Generate compatibility checks
  const checks = generateCommonChecks(packages);
  
  // Build output matrix
  const matrix: CompatibilityMatrix = {
    generated: new Date().toISOString(),
    packages,
    checks,
  };
  
  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(matrix, null, 2));
  
  console.log(`\n✓ Successfully wrote compatibility matrix to ${OUTPUT_FILE}`);
  
  // Print summary statistics
  const totalChecks = Object.keys(checks).length;
  const compatibleChecks = Object.values(checks).filter((c) => c.compatible).length;
  const incompatibleChecks = totalChecks - compatibleChecks;
  const pct = (n: number) => (totalChecks === 0 ? '0.0' : ((n / totalChecks) * 100).toFixed(1));

  console.log('\nSummary:');
  console.log(`  Total checks: ${totalChecks}`);
  console.log(`  Compatible: ${compatibleChecks} (${pct(compatibleChecks)}%)`);
  console.log(`  Incompatible: ${incompatibleChecks} (${pct(incompatibleChecks)}%)`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
