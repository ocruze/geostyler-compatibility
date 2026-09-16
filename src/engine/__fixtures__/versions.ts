import type { Package, PackageVersion } from '@/types/compatibility';

import fixture from './versions.json';

// Real registry-derived records, frozen for the cases the old model got wrong.
export const records = fixture as PackageVersion[];

export function fx(name: string, version: string): PackageVersion {
  const record = records.find((r) => r.name === name && r.version === version);
  if (!record) throw new Error(`fixture missing ${name}@${version}`);
  return record;
}

// A Package built from fixture records, newest-first as in the dataset.
export function fxPackage(name: string, ...versions: string[]): Package {
  const records = versions.map((v) => fx(name, v));
  return { name, category: records[0].category, versions: records, latestVersion: records[0].version, repositoryUrl: '' };
}
