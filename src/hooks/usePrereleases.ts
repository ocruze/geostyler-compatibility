import { createContext, useContext } from 'react';

// A browser preference, not URL state: a shared link never forces prereleases on the recipient.
export const PRERELEASE_STORAGE_KEY = 'geostyler-compatibility.includePrereleases';

export const PrereleaseContext = createContext<[boolean, (include: boolean) => void]>([false, () => {}]);

export function readPrereleasePreference(): boolean {
  try {
    return window.localStorage.getItem(PRERELEASE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function usePrereleases() {
  return useContext(PrereleaseContext);
}
