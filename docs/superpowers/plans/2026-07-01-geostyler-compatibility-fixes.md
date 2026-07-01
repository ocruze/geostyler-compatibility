# GeoStyler Compatibility — Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Plan location note:** This file lives at `~/.claude/plans/you-have-an-understanding-swirling-thimble.md` (written under plan-mode constraints). At execution start, copy it into the repo at `docs/superpowers/plans/2026-07-01-geostyler-compatibility-fixes.md` and work from there.

**Goal:** Fix the correctness of the compatibility engine and data pipeline, then repair the highest-impact UX/UI defects, so the dashboard reports trustworthy results and is usable on all devices.

**Architecture:** Two independently-shippable tracks. **Track A (Phases 0–2)** replaces the sampling-based semver approximation with real `semver` range math, reads ESM status from npm metadata instead of guessing, and makes peer-dep checks symmetric — all under new Vitest unit tests. **Track B (Phases 3–4)** fixes the dead Category filter, the misleading version matrix, mobile layout, accessibility, and cleans up dead code/theming. Track A can be delivered and merged before Track B is started.

**Tech Stack:** React 18, Vite 7, TypeScript 5.6 (strict), Ant Design v6.3, TanStack Router, `semver` 7, `tsx` scripts, **Vitest** (new).

## Global Constraints

- Node pinned to `24.14.0` (`.nvmrc`); use `npm`.
- `antd@6.3.1`: `Alert` uses **`title`** and `Space` uses **`orientation`** — these are the CURRENT v6 props (`message`/`direction` are deprecated). **Do NOT "fix" existing `title=`/`orientation=` usages — they are correct.**
- TypeScript is `strict` with `noUnusedLocals`/`noUnusedParameters` — no unused vars, no `any` in new code.
- `src/data/*.json` is generated and gitignored; regenerate with `npm run generate-data`.
- `intersectRanges` in `src/utils/semver.ts` is the single shared core used by both `scripts/compute-compatibility.ts` and `src/api/queries.ts`. Any change to it affects both.
- Keep the Vite base path `"/geostyler-compatibility/"` unchanged.
- Commit after every task with the shown message.

---

## Phase 0 — Test tooling

### Task 0: Add Vitest

**Files:**
- Modify: `package.json` (devDependencies + scripts)
- Create: `vitest.config.ts`
- Create: `src/utils/semver.test.ts`

**Interfaces:**
- Produces: `npm test` runs Vitest once; the `@` alias resolves in tests.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest@^2.1.0`
Expected: adds `vitest` to devDependencies, no peer errors.

- [ ] **Step 2: Add the test script**

In `package.json` `scripts`, add after the `lint` line:
```json
        "test": "vitest run",
        "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add a smoke test** in `src/utils/semver.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { satisfies } from '@/utils/semver';

describe('test harness', () => {
  it('runs', () => {
    expect(satisfies('1.2.3', '^1.0.0')).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/utils/semver.test.ts
git commit -m "test: add Vitest with @ alias and smoke test"
```

---

## Phase 1 — Compatibility engine correctness

### Task 1: Replace `intersectRanges`/`rangesOverlap` with real semver math

**Files:**
- Modify: `src/utils/semver.ts:7-53`
- Test: `src/utils/semver.test.ts`

**Interfaces:**
- Consumes: `semver` package (already a dep).
- Produces: `intersectRanges(ranges: string[]): string | null` — returns a valid range string satisfied by every input range, or `null` when the intersection is empty/all-invalid. `rangesOverlap(a: string, b: string): boolean`.

- [ ] **Step 1: Write failing tests** — append to `src/utils/semver.test.ts`:

```ts
import { intersectRanges, rangesOverlap } from '@/utils/semver';

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
```

- [ ] **Step 2: Run to confirm failures**

Run: `npm test`
Expected: the disjoint / minor>10 / non-.0-patch cases FAIL against the current sampling implementation.

- [ ] **Step 3: Replace the implementation** — in `src/utils/semver.ts`, replace lines 3-46 (the docblock + `intersectRanges`) with:

```ts
/**
 * Find the intersection of a set of semver ranges.
 * Returns a range string satisfied by EVERY input range, or null if the
 * intersection is empty (or all inputs are invalid).
 *
 * NOTE: inputs are ANDed by concatenation, which is exact for simple ranges
 * (carets/tildes/comparators). geostyler-style ranges in this dataset never
 * use `||`; if a `||` range is ever introduced, revisit this.
 */
export function intersectRanges(ranges: string[]): string | null {
  const valid = ranges.filter((r) => semver.validRange(r) !== null);
  if (valid.length === 0) return null;
  // Common case: all inputs identical -> return the pretty original.
  if (valid.every((r) => r === valid[0])) return valid[0];
  const combined = valid.join(' ');
  const normalized = semver.validRange(combined);
  if (!normalized) return null;
  // minVersion is null when the combined range is unsatisfiable (empty set).
  if (!semver.minVersion(normalized)) return null;
  return normalized;
}
```

- [ ] **Step 4: Simplify `rangesOverlap`** — replace `src/utils/semver.ts` `rangesOverlap` body so it reads:

```ts
export function rangesOverlap(range1: string, range2: string): boolean {
  return intersectRanges([range1, range2]) !== null;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all `intersectRanges`/`rangesOverlap` tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/semver.ts src/utils/semver.test.ts
git commit -m "fix: real semver range intersection, drop sampling approximation"
```

### Task 2: Make `compareVersions` stop lying about invalid input

**Files:**
- Modify: `src/utils/semver.ts:80-86`
- Test: `src/utils/semver.test.ts`

**Interfaces:**
- Produces: `compareVersions(v1, v2): number` — throws on invalid input instead of returning `0`.

- [ ] **Step 1: Failing test** — append:

```ts
import { compareVersions } from '@/utils/semver';

describe('compareVersions', () => {
  it('orders valid versions', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
  });
  it('throws on invalid input rather than reporting equal', () => {
    expect(() => compareVersions('nope', '1.0.0')).toThrow();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: the "throws" test FAILS (current code returns 0).

- [ ] **Step 3: Implement** — replace `compareVersions` body:

```ts
export function compareVersions(v1: string, v2: string): number {
  return semver.compare(v1, v2);
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/semver.ts src/utils/semver.test.ts
git commit -m "fix: compareVersions throws on invalid input instead of faking equality"
```

### Task 3: Symmetric peer-dependency checks + one definition of "compatible"

**Files:**
- Modify: `scripts/compute-compatibility.ts:66-90` (peer-dep loop)
- Modify: `src/api/queries.ts:70-108` (`checkVersionCompatibility`)
- Test: `src/api/queries.test.ts` (create)

**Interfaces:**
- Consumes: `PackageVersion` from `@/types/compatibility`.
- Produces: `checkVersionCompatibility(v1, v2)` now also reports `peer-dep-conflict` (both directions) as a hard incompatibility, matching the build script.

- [ ] **Step 1: Make the build peer-dep check bidirectional** — in `scripts/compute-compatibility.ts`, replace the single peer loop (lines 66-87) with:

```ts
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
```

- [ ] **Step 2: Write failing tests for the runtime check** — create `src/api/queries.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkVersionCompatibility } from '@/api/queries';
import type { PackageVersion } from '@/types/compatibility';

const v = (over: Partial<PackageVersion>): PackageVersion => ({
  name: 'x', version: '1.0.0', category: 'style-parser',
  dependencies: {}, peerDependencies: {}, esmSupport: true,
  publishDate: '2024-01-01', isPrerelease: false,
  repositoryUrl: '', npmUrl: '', ...over,
});

describe('checkVersionCompatibility', () => {
  it('incompatible when geostyler-style ranges are disjoint', () => {
    const r = checkVersionCompatibility(
      v({ name: 'a', geostylerStyleRange: '^11.0.0' }),
      v({ name: 'b', geostylerStyleRange: '^12.0.0' }),
    );
    expect(r.compatible).toBe(false);
  });

  it('flags peer-dep conflict (either direction)', () => {
    const r = checkVersionCompatibility(
      v({ name: 'a', version: '1.0.0', peerDependencies: { b: '^2.0.0' } }),
      v({ name: 'b', version: '1.0.0' }),
    );
    expect(r.compatible).toBe(false);
    expect(r.reason).toMatch(/peer/i);
  });

  it('warns (not fails) on ESM/CJS mismatch', () => {
    const r = checkVersionCompatibility(
      v({ name: 'a', esmSupport: true }),
      v({ name: 'b', esmSupport: false }),
    );
    expect(r.compatible).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2b: Run to confirm the peer test fails**

Run: `npm test`
Expected: the peer-dep test FAILS (runtime check ignores peers today).

- [ ] **Step 3: Extend `checkVersionCompatibility`** — in `src/api/queries.ts`, add peer checking before the ESM block. Insert after line 94 (the `if (range1 && range2)` block) and before the ESM comment:

```ts
  // Peer-dependency conflicts (both directions) — matches the build script
  const peerConflict = (a: PackageVersion, b: PackageVersion): string | null => {
    const range = a.peerDependencies?.[b.name];
    if (!range) return null;
    try {
      return semver.satisfies(b.version, range)
        ? null
        : `${a.name}@${a.version} requires peer ${b.name}@${range}, but found ${b.version}`;
    } catch {
      return null;
    }
  };
  const peerReason = peerConflict(v1, v2) ?? peerConflict(v2, v1);
  if (peerReason) {
    return { compatible: false, sharedRange, reason: peerReason, warnings };
  }
```

- [ ] **Step 4: Import semver in queries.ts** — change the top imports to add:

```ts
import * as semver from 'semver';
```

- [ ] **Step 5: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add scripts/compute-compatibility.ts src/api/queries.ts src/api/queries.test.ts
git commit -m "fix: symmetric peer-dep checks in build and runtime compatibility"
```

---

## Phase 2 — Data pipeline correctness

### Task 4: Read ESM support from npm metadata; delete threshold guessing

**Files:**
- Modify: `scripts/fetch-metadata.ts:97-144`
- Modify: `src/constants/repos.ts` (remove `ESM_VERSION_THRESHOLD`, derive `REPO_TO_NPM`)
- Test: `scripts/detect-esm.test.ts` (create)

**Interfaces:**
- Produces: `detectEsmSupport(versionData): boolean` reading real `type`/`exports`/`module` fields.

- [ ] **Step 1: Failing test** — create `scripts/detect-esm.test.ts`:

```ts
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
```

Add `include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']` to `vitest.config.ts`.

- [ ] **Step 2: Run to confirm failure**

Run: `npm test`
Expected: FAIL — `detectEsmSupport` not exported.

- [ ] **Step 3: Implement + export** in `scripts/fetch-metadata.ts`. Replace `supportsESM` (lines 97-109) with:

```ts
/**
 * Detect ESM support from the version's package.json metadata.
 * Prefers ground truth over version-number guessing.
 */
export function detectEsmSupport(versionData: any): boolean {
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
```

- [ ] **Step 4: Use it** — in `processNpmData`, change line 144 from `esmSupport: supportsESM(npmPackageName, versionTag),` to:

```ts
      esmSupport: detectEsmSupport(versionData),
```

- [ ] **Step 5: Clean up `repos.ts`** — delete the entire `ESM_VERSION_THRESHOLD` export (lines 49-69) and replace the hand-written `REPO_TO_NPM` (lines 27-47) with a derived map:

```ts
/** Package name to npm package name mapping (derived from REPOS). */
export const REPO_TO_NPM: Record<string, string> = Object.fromEntries(
  REPOS.map((repo) => [repo, repo.split('/')[1]]),
);
```

- [ ] **Step 6: Drop the dead import** — in `scripts/fetch-metadata.ts:11`, change the import to:

```ts
import { REPOS, REPO_TO_NPM } from '../src/constants/repos.js';
```

- [ ] **Step 7: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: pass.

- [ ] **Step 8: Regenerate data and spot-check ESM**

Run: `npm run generate-data`
Expected: completes; `geostyler-cql-parser` now shows real ESM/CJS per its published metadata (no longer forced CJS).

- [ ] **Step 9: Commit**

```bash
git add scripts/fetch-metadata.ts src/constants/repos.ts scripts/detect-esm.test.ts vitest.config.ts
git commit -m "fix: detect ESM from npm metadata; derive REPO_TO_NPM; drop version thresholds"
```

### Task 5: Stop fabricating data in fetch-metadata

**Files:**
- Modify: `scripts/fetch-metadata.ts:129-158, 183-198`

**Interfaces:** none (build-time behavior only).

- [ ] **Step 1: Remove the fabricated geostyler-data dependency** — replace lines 133-139 (the `dependencies:` object with the injected `geostyler-data`) with:

```ts
      dependencies: versionData.dependencies || {},
```

- [ ] **Step 2: Do not backdate missing publish dates** — change line 145 to make a missing date explicit rather than "now":

```ts
      publishDate: npmData.time?.[versionTag] ?? '',
```

- [ ] **Step 3: Fix the stale changelog branch** — change line 148 from `/blob/master/` to `/blob/main/`:

```ts
      changelogUrl: `https://github.com/${repoName}/blob/main/CHANGELOG.md`,
```

- [ ] **Step 4: Surface dropped packages instead of silently continuing** — change lines 186-189 to track failures:

```ts
    if (!npmData) {
      console.error(`Skipping ${repo} - no npm data`);
      failures.push(repo);
      continue;
    }
```

Declare `const failures: string[] = [];` next to `const packages: Package[] = [];` (line 176), and after the write (after line 209) add:

```ts
  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} package(s) failed to fetch: ${failures.join(', ')}`);
    process.exitCode = 1;
  }
```

- [ ] **Step 5: Fix the misleading comments** — change the file header (lines 4-6) and line 183 comment to describe reality (npm registry only; serial fetch). New header:

```ts
/**
 * Fetches package metadata from the npm registry (serial, rate-limited).
 * Generates src/data/packages.json
 */
```

- [ ] **Step 6: Regenerate + verify**

Run: `npm run generate-data && npx tsc --noEmit`
Expected: data regenerates; a known-incompatible pair (an old parser pinned to `^9` vs `geostyler-style@12`) is now reported incompatible in `src/data/compatibility-matrix.json` (search the file). If all pairs are still `"compatible": true`, investigate before continuing.

- [ ] **Step 7: Commit**

```bash
git add scripts/fetch-metadata.ts
git commit -m "fix: remove fabricated deps/dates and stale comments; surface fetch failures"
```

### Task 6: Divide-by-zero guard + honest "latest" selection in compute script

**Files:**
- Modify: `scripts/compute-compatibility.ts:217-224, 148-151`

- [ ] **Step 1: Guard the summary math** — replace lines 217-224 with:

```ts
  const totalChecks = Object.keys(checks).length;
  const compatibleChecks = Object.values(checks).filter((c) => c.compatible).length;
  const incompatibleChecks = totalChecks - compatibleChecks;
  const pct = (n: number) => (totalChecks === 0 ? '0.0' : ((n / totalChecks) * 100).toFixed(1));

  console.log('\nSummary:');
  console.log(`  Total checks: ${totalChecks}`);
  console.log(`  Compatible: ${compatibleChecks} (${pct(compatibleChecks)}%)`);
  console.log(`  Incompatible: ${incompatibleChecks} (${pct(incompatibleChecks)}%)`);
```

- [ ] **Step 2: Only use real latest, and skip packages without one** — replace lines 148-151 with:

```ts
  const latestVersions = packages
    .map((pkg) => pkg.versions.find((v) => v.version === pkg.latestVersion))
    .filter((v): v is PackageVersion => !!v && !v.isPrerelease);
```

- [ ] **Step 3: Run + regenerate**

Run: `npm run compute-compatibility && npx tsc --noEmit`
Expected: no NaN in summary; completes.

- [ ] **Step 4: Commit**

```bash
git add scripts/compute-compatibility.ts
git commit -m "fix: guard summary divide-by-zero and use only real latest versions"
```

### Task 7: Delete dead types and stale README/docblocks

**Files:**
- Modify: `src/types/compatibility.ts` (remove `RepoMetadata`, `UnsupportedProperties`, `SupportLevel` if now unused, `'build-incompatibility'`)
- Modify: `scripts/compute-compatibility.ts:3-7` (header says `public/data`)

- [ ] **Step 1: Remove unused types** — delete `RepoMetadata` (lines 115-126) and `UnsupportedProperties` (lines 128-136) from `src/types/compatibility.ts`. Remove `'build-incompatibility'` from `ConflictReason` (line 77). If `SupportLevel` (line 29) is now unreferenced, delete it too.

- [ ] **Step 2: Fix the compute-script header** — change `scripts/compute-compatibility.ts` line 6 to `Generates src/data/compatibility-matrix.json`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit && npm test`
Expected: no unused-symbol errors, tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/types/compatibility.ts scripts/compute-compatibility.ts
git commit -m "chore: remove dead types and correct stale docblocks"
```

---

## Phase 3 — UI correctness & UX

### Task 8: Make the Dashboard Category & Module-System filters actually filter

**Files:**
- Modify: `src/routes/index.tsx:34-46` and the render that builds `grouped`

**Interfaces:**
- Consumes: `selectedCategory`, `esmFilter` state (already declared, lines 15-16).

- [ ] **Step 1: Apply both filters before grouping** — replace lines 34-46 with:

```ts
  // Apply filters
  const visiblePackages = packages.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    if (esmFilter !== 'all') {
      const latest = p.versions.find((v) => v.version === p.latestVersion);
      const isEsm = latest?.esmSupport ?? false;
      if (esmFilter === 'esm' && !isEsm) return false;
      if (esmFilter === 'cjs' && isEsm) return false;
    }
    return true;
  });

  // Group packages by category
  const grouped: Record<PackageCategory, Package[]> = {
    core: visiblePackages.filter((p) => p.category === 'core'),
    ui: visiblePackages.filter((p) => p.category === 'ui'),
    'style-parser': visiblePackages.filter((p) => p.category === 'style-parser'),
    'data-parser': visiblePackages.filter((p) => p.category === 'data-parser'),
  };
```

- [ ] **Step 2: Hide empty category cards** — where category cards are rendered (the `.map` over category keys), skip a category whose `grouped[cat].length === 0` so filtered-out sections don't show empty tables. (Read the render block first; add `if (grouped[cat].length === 0) return null;` inside the map callback.)

- [ ] **Step 3: Verify in the browser**

Run: `npm run dev`, open `http://localhost:5174/geostyler-compatibility/`, set Category = "Style parser": only the style-parser table shows. Set Module System = "CJS": only CJS packages remain.

- [ ] **Step 4: Commit**

```bash
git add src/routes/index.tsx
git commit -m "fix: dashboard category and module-system filters now filter the list"
```

### Task 9: Reconcile the Overview stat cards with the total

**Files:**
- Modify: `src/routes/index.tsx` (the `Statistic` row)

- [ ] **Step 1: Add the missing Core count** — in the stats row, add a `Core` statistic alongside Total/Style/Data/UI so the four category counts sum to Total. Use `grouped.core.length` (computed against unfiltered `packages`, not `visiblePackages`, so totals stay stable). Read the row first; add:

```tsx
<Col xs={12} sm={8} md={4}><Statistic title="Core" value={packages.filter((p) => p.category === 'core').length} /></Col>
```

and give every existing `<Col>` in that row responsive spans (`xs={12} sm={8} md={4}`) so the row wraps on mobile.

- [ ] **Step 2: Verify** the five counts (Core + Style + Data + UI) equal Total in the browser.

- [ ] **Step 3: Commit**

```bash
git add src/routes/index.tsx
git commit -m "fix: include Core in overview stats so counts reconcile with total"
```

### Task 10: Responsive header nav (kill horizontal overflow on mobile)

**Files:**
- Modify: `src/routes/__root.tsx:30-55`

- [ ] **Step 1: Make the header wrap and the menu overflow gracefully** — replace the `Header`/`h1`/`Menu` block (lines 32-51) so the title truncates and the Menu uses AntD's built-in overflow. Key changes: add `overflow: 'hidden'` + `whiteSpace: 'nowrap'` + `textOverflow: 'ellipsis'` + `minWidth: 0` to the `h1`, drop `flex: 1` from the Menu, and let the `Header` keep `display:flex`. Concretely:

```tsx
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          GeoStyler Compatibility
        </h1>
        <Menu
          mode="horizontal"
          selectedKeys={[currentPath]}
          items={menuItems}
          style={{ border: 'none', justifyContent: 'flex-end', flex: '0 1 auto', minWidth: 0 }}
          overflowedIndicator={<MenuOutlined />}
        />
```

Add `MenuOutlined` to the `@ant-design/icons` import on line 3.

- [ ] **Step 2: Highlight the active nav item on detail pages** — change line 47 `selectedKeys={[currentPath]}` to match `/package/*` to no root item but keep Compare/Docs correct:

```tsx
            selectedKeys={[menuItems.find((m) => currentPath === m.key || (m.key !== '/' && currentPath.startsWith(m.key)))?.key ?? '']}
```

- [ ] **Step 3: Verify at 390px** — in the browser devtools (or Playwright resize to 390×844), confirm the page has **no horizontal scrollbar** and all nav items are reachable (via the overflow menu if needed).

- [ ] **Step 4: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "fix: responsive header nav, no mobile horizontal overflow"
```

### Task 11: Redesign the Version Compatibility Matrix (kill the wall of green)

**Files:**
- Modify: `src/routes/compare.tsx` (the `CompatibilityResults` / matrix section)

**Context:** Today the matrix renders every version × every version (~6,000 cells) as identical green checks — no signal, forces horizontal scroll, and produces an 85 KB a11y tree. Read the matrix-rendering block in `compare.tsx` before editing.

- [ ] **Step 1: Collapse the matrix by default** — wrap the full grid in an AntD `Collapse` panel titled e.g. `Full version-by-version matrix (N×M)`, collapsed by default, so the page leads with the summary (Compatible/Shared Range/Recommended pair) instead of the grid.

- [ ] **Step 2: Add a "problems only" toggle** — above the grid add a `Switch` (default on) labeled `Show only incompatible / warning combinations`. When on, render only rows/cells whose result is `!compatible` or has warnings; when there are none, show an AntD `Empty`/`Result` with `status="success"` reading "All checked version combinations are compatible." This is the honest, information-dense default.

- [ ] **Step 3: Keep the cell count bounded and disclosed** — the matrix already slices to 20×20 in `getVersionCompatibilityMatrix` (`src/api/queries.ts:141-142`). Change the two `.slice(0, 20)` calls to select the newest 20 explicitly and add a visible note under the grid: `Showing the 20 most recent versions of each package.` (versions are already sorted newest-first, so `.slice(0, 20)` is correct — just fix the misleading comment on those lines to say "newest 20").

- [ ] **Step 4: Verify** — select geostyler-sld-parser + geostyler-style: the page now leads with the verdict, the full grid is collapsed, and toggling "problems only" shows the success state (or only the red/amber cells). Confirm the a11y snapshot is dramatically smaller.

- [ ] **Step 5: Commit**

```bash
git add src/routes/compare.tsx src/api/queries.ts
git commit -m "feat: matrix leads with verdict, problems-only view, collapsed full grid"
```

### Task 12: Accessibility — keyboard, labels, link security

**Files:**
- Modify: `src/routes/compare.tsx` (matrix cells, clear button)
- Modify: `src/routes/package.$name.tsx:44-76, 255-266`
- Modify: `src/routes/index.tsx` (external-link buttons)

- [ ] **Step 1: Keyboard-operable matrix cells** — for each clickable matrix cell `<div onClick=...>`, add `role="button"`, `tabIndex={0}`, an `aria-label` describing the pair + verdict, and an `onKeyDown` that triggers the same handler on `Enter`/`Space`. (Read the cell render; apply to that element.)

- [ ] **Step 2: Label the clear button** — the icon-only clear `<Button icon={<CloseCircleOutlined />}>` in `compare.tsx` gets `aria-label="Clear selected packages"`.

- [ ] **Step 3: Secure/real external links in package detail** — in `src/routes/package.$name.tsx`, replace the two `window.open(..., '_blank')` buttons (lines 66, 72) with real anchors carrying `rel="noopener noreferrer"`:

```tsx
          <Button type="primary" icon={<GithubOutlined />} href={pkg.repositoryUrl} target="_blank" rel="noopener noreferrer">
            GitHub Repository
          </Button>
          <Button icon={<LinkOutlined />} href={`https://www.npmjs.com/package/${pkg.name}`} target="_blank" rel="noopener noreferrer">
            npm Package
          </Button>
```

- [ ] **Step 4: Replace `window.history.back()`** (line 47) with a router link fallback:

```tsx
      <Link to="/"><Button type="text" icon={<ArrowLeftOutlined />}>Back to Dashboard</Button></Link>
```

- [ ] **Step 5: Add `rel` to dashboard external links** — in `src/routes/index.tsx` add `rel="noopener noreferrer"` to the two `target="_blank"` link buttons (lines 165, 174).

- [ ] **Step 6: Keyboard-selectable version rows** — the `VersionHistoryTable` `onRow` click (package.$name.tsx:261-264) is mouse-only. Either remove the row-click (the Select already covers version choice) or add a real focusable control in the Version column. Simplest: remove the `onRow` click handler and its `cursor:pointer` so there's no inaccessible-only affordance.

- [ ] **Step 7: Verify** — tab through Compare (cells focusable, Enter opens modal), package detail (Back is a link, external links open safely), and run an a11y check (e.g. browser Lighthouse) — no "links to cross-origin destinations are unsafe" or "buttons without accessible name" for these elements.

- [ ] **Step 8: Commit**

```bash
git add src/routes/compare.tsx src/routes/package.$name.tsx src/routes/index.tsx
git commit -m "fix: keyboard support, aria labels, safe external links"
```

---

## Phase 4 — Polish & cleanup

### Task 13: Remove dead CSS

**Files:** Delete `src/index.css`

- [ ] **Step 1: Confirm it is unimported**

Run: `grep -rn "index.css" src/`
Expected: no results.

- [ ] **Step 2: Delete + verify build**

Run: `rm src/index.css && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused src/index.css"
```

### Task 14: Central theme tokens + AntD App wrapper + per-route titles

**Files:**
- Modify: `src/main.tsx`
- Modify: `index.html`
- Modify: route components (set titles)

- [ ] **Step 1: Add theme tokens, `<App>` wrapper, and locale** — replace `src/main.tsx` render block (lines 21-27) with:

```tsx
import { ConfigProvider, App as AntApp, theme } from 'antd';
import enUS from 'antd/locale/en_US';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={enUS}
      theme={{ token: { colorPrimary: '#1677ff' }, algorithm: theme.defaultAlgorithm }}
    >
      <AntApp>
        <RouterProvider router={router} />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
```

(Adjust the existing `import { ConfigProvider } from 'antd'` on line 4 to the combined import above.)

- [ ] **Step 2: Add SEO meta + per-route titles** — in `index.html` add inside `<head>`: `<meta name="description" content="Compatibility dashboard for GeoStyler style/data parsers and UI packages." />`. Then in each route component set `document.title` in a `useEffect` (e.g. Compare → `"Compare · GeoStyler Compatibility"`, Docs → `"Docs · …"`, package detail → `` `${pkg.name} · GeoStyler Compatibility` ``).

- [ ] **Step 3: Verify** — the browser tab title changes per route; the `message`/`Modal` statics no longer log the "static function can not consume context" warning.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx index.html src/routes
git commit -m "feat: theme tokens, AntD App wrapper, locale, per-route titles + meta"
```

### Task 15: Router error & not-found boundaries

**Files:** Modify `src/main.tsx` (router options); optionally `src/routes/__root.tsx`

- [ ] **Step 1: Add default error + not-found components** — in `createRouter({...})` add:

```tsx
  defaultNotFoundComponent: () => <div style={{ padding: 24 }}>Page not found. <a href={import.meta.env.BASE_URL}>Go home</a></div>,
  defaultErrorComponent: ({ error }: { error: Error }) => <div style={{ padding: 24 }}>Something went wrong: {error.message}</div>,
```

- [ ] **Step 2: Verify** — visiting `/geostyler-compatibility/nope` shows the not-found component instead of a blank screen.

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: router not-found and error boundaries"
```

### Task 16: Reconcile docs with the actual app + remove the disabled nav item

**Files:** Modify `src/routes/docs.tsx`, `src/routes/__root.tsx`

- [ ] **Step 1: Fix the phantom "Search" claim** — in `docs.tsx` remove/replace the sentence that describes a dashboard "Search" filter (the app has Category + Module System filters, not Search).

- [ ] **Step 2: Correct the "select 2 or more" claim** — the version matrix supports exactly 2 packages; update the docs copy to say "select exactly 2 packages to see the version matrix" (the summary analysis still supports more).

- [ ] **Step 3: Remove the disabled/empty nav menu item** — inspect `menuItems` in `__root.tsx`; there is a trailing disabled/empty entry rendering in the header. Remove it (or, if it was intended as a dark-mode toggle, implement it with `theme.darkAlgorithm` — otherwise delete).

- [ ] **Step 4: Verify** in the browser — docs match reality; no empty disabled item in the nav.

- [ ] **Step 5: Commit**

```bash
git add src/routes/docs.tsx src/routes/__root.tsx
git commit -m "docs: match real filters and matrix behavior; remove dead nav item"
```

### Task 17: Fix the broken lint script (optional but recommended)

**Files:** Modify `package.json`; create `eslint.config.js`

**Context:** `npm run lint` fails — the script uses ESLint-8 `--ext` flags but ESLint 9 needs a flat config. Devdeps (`@typescript-eslint/*`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`) are already present.

- [ ] **Step 1: Create `eslint.config.js`** wiring `@typescript-eslint`, `react-hooks`, and `react-refresh` for `**/*.{ts,tsx}`, ignoring `src/routeTree.gen.ts` and `src/data/`.

- [ ] **Step 2: Simplify the script** — change `package.json` line 13 to `"lint": "eslint . --report-unused-disable-directives --max-warnings 0"`.

- [ ] **Step 3: Run lint and fix real warnings**

Run: `npm run lint`
Expected: runs to completion; fix any genuine issues it surfaces (unused `any`, missing hook deps).

- [ ] **Step 4: Commit**

```bash
git add package.json eslint.config.js
git commit -m "build: add ESLint flat config and fix lint script"
```

---

## Self-Review notes

- **Correction honored:** no task touches `Alert title=`/`Space orientation=` — verified correct for antd 6.3.1.
- **Type consistency:** `detectEsmSupport` (Task 4) is the name used in both its test and its call site; `intersectRanges` signature unchanged so all callers keep working; `checkVersionCompatibility` return shape (`{compatible, sharedRange, reason?, warnings}`) is preserved (Task 3 only adds an early return).
- **Coverage:** every confirmed finding from the review maps to a task (semver→T1/T2, peer/unify→T3, ESM→T4, fabrication→T5, divide-by-zero/latest→T6, dead types→T7, dead filter→T8, stats→T9, mobile nav→T10, matrix→T11, a11y/links→T12, dead CSS→T13, theme/titles→T14, error boundary→T15, docs/nav→T16, lint→T17).

## Final verification (run after all phases)

- `npm test` — all unit tests pass.
- `npm run generate-data` — completes; grep `src/data/compatibility-matrix.json` for at least one `"compatible": false` on a genuinely disjoint pair.
- `npm run build` — `tsc` strict + Vite build succeed.
- `npm run dev` + Playwright: category/module filters work; overview counts reconcile; no mobile horizontal scroll at 390px; Compare leads with a verdict and the full grid is collapsed; matrix cells and Back link are keyboard-operable; tab titles change per route; `/nope` shows the not-found boundary.
- Delete review screenshots before committing: `compare-analysis.png`, `package-detail.png`, `mobile-dashboard.png`, and the `.playwright-mcp/` dir in the repo root.
