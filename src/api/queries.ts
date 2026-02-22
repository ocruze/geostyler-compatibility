import type { Package, CompatibilityMatrix } from '@/types/compatibility';
import packagesData from '@/data/packages.json';
import compatibilityData from '@/data/compatibility-matrix.json';

/**
 * Hook to fetch all packages
 */
export function usePackages() {
  return {
    data: packagesData as Package[],
    isLoading: false,
    error: null as Error | null,
  };
}

/**
 * Hook to fetch compatibility matrix
 */
export function useCompatibilityMatrix() {
  return {
    data: compatibilityData as CompatibilityMatrix,
    isLoading: false,
    error: null as Error | null,
  };
}

/**
 * Hook to get a specific package by name
 */
export function usePackage(name: string) {
  const { data: packages, ...rest } = usePackages();
  
  const pkg = packages?.find(p => p.name === name);
  
  return {
    ...rest,
    data: pkg,
  };
}

/**
 * Hook to get compatibility check for specific packages
 */
export function useCompatibilityCheck(packageIds: string[]) {
  const { data: matrix, ...rest } = useCompatibilityMatrix();
  
  const key = packageIds.sort().join(',');
  const check = matrix?.checks[key];
  
  return {
    ...rest,
    data: check,
  };
}
