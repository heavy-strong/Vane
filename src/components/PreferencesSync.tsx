'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import {
  getPreference,
  PREFERENCES_CHANGED_EVENT,
  PreferencesChangedDetail,
  startPreferenceSync,
} from '@/lib/preferences/client';

// Rendering waits for the shared preferences so components never start from (and write back) a
// stale per-device copy; a slow or unreachable server falls back to that copy.
const LOAD_TIMEOUT_MS = 3000;

const PreferencesSync = ({ children }: { children: React.ReactNode }) => {
  const [ready, setReady] = useState(false);
  const { setTheme } = useTheme();

  useEffect(() => {
    let active = true;
    const applyTheme = () => {
      const theme = getPreference('theme');
      if (theme) setTheme(theme);
    };
    const onChange = (event: Event) => {
      const { keys, remote } = (event as CustomEvent<PreferencesChangedDetail>)
        .detail;
      if (remote && keys.includes('theme')) applyTheme();
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, onChange);

    Promise.race([
      startPreferenceSync(),
      new Promise((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS)),
    ]).then(() => {
      if (!active) return;
      applyTheme();
      setReady(true);
    });

    return () => {
      active = false;
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, onChange);
    };
  }, [setTheme]);

  return ready ? <>{children}</> : null;
};

export default PreferencesSync;
