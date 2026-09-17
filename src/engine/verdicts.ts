import type { Verdict } from '@/types/compatibility';

// Strongest first, the order legends and docs list them in.
export const VERDICTS: Verdict[] = [
  'conflict', 'risk', 'duplicate', 'shipped-together', 'compatible', 'independent', 'unknown',
];
