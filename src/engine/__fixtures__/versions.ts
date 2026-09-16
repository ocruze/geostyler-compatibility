import type { PackageVersion } from '@/types/compatibility';

import fixture from './versions.json';

// Real registry-derived records, frozen for the cases the old model got wrong.
export const records = fixture as PackageVersion[];

export function fx(name: string, version: string): PackageVersion {
  const record = records.find((r) => r.name === name && r.version === version);
  if (!record) throw new Error(`fixture missing ${name}@${version}`);
  return record;
}
