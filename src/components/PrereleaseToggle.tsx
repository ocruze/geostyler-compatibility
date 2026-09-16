import { Switch } from 'antd';
import { useCallback, useState, type ReactNode } from 'react';

import { PRERELEASE_STORAGE_KEY, PrereleaseContext, readPrereleasePreference, usePrereleases } from '@/hooks/usePrereleases';

export function PrereleaseProvider({ children }: { children: ReactNode }) {
  const [include, setInclude] = useState(readPrereleasePreference);
  const update = useCallback((next: boolean) => {
    setInclude(next);
    try {
      window.localStorage.setItem(PRERELEASE_STORAGE_KEY, String(next));
    } catch {
      // Private mode or blocked storage: the toggle still works for this visit.
    }
  }, []);
  return <PrereleaseContext.Provider value={[include, update]}>{children}</PrereleaseContext.Provider>;
}

export function PrereleaseToggle() {
  const [include, setInclude] = usePrereleases();
  return (
    <label className="prerelease-toggle">
      <Switch size="small" checked={include} onChange={setInclude} />
      Show prereleases
    </label>
  );
}
