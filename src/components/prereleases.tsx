/* eslint-disable react-refresh/only-export-components -- the provider, its hook and its toggle belong together */
import { Switch } from 'antd';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

// A browser preference, not URL state: a shared link never forces prereleases on the recipient.
const STORAGE_KEY = 'geostyler-compatibility.showPrereleases';

const PrereleaseContext = createContext<[boolean, (show: boolean) => void]>([false, () => {}]);

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function PrereleaseProvider({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(readPreference);
  const update = useCallback((next: boolean) => {
    setShow(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Private mode or blocked storage: the toggle still works for this visit.
    }
  }, []);
  return <PrereleaseContext.Provider value={[show, update]}>{children}</PrereleaseContext.Provider>;
}

export function usePrereleases() {
  return useContext(PrereleaseContext);
}

export function PrereleaseToggle() {
  const [show, setShow] = usePrereleases();
  return (
    <label className="prerelease-toggle">
      <Switch size="small" checked={show} onChange={setShow} />
      Show prereleases
    </label>
  );
}
