import type { Dataset } from '@/types/compatibility';
import packagesData from '@/data/packages.json';

const dataset = packagesData as Dataset;

export const datasetGeneratedAt = dataset.generatedAt;

// Synchronous wrapper over the build-time dataset; no fetching or caching happens at runtime.
export function usePackages() {
  return {
    data: dataset.packages,
    isLoading: false,
    error: null as Error | null,
  };
}
