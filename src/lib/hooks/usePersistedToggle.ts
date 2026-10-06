'use client';

import { useCallback, useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();

const read = (key: string, fallback: boolean) => {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored === 'true';
  } catch {
    return fallback;
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
};

/** A boolean UI preference persisted in localStorage (falls back on SSR). */
export const usePersistedToggle = (key: string, fallback: boolean) => {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    () => fallback,
  );

  const toggle = useCallback(() => {
    try {
      localStorage.setItem(key, String(!read(key, fallback)));
    } catch {}
    listeners.forEach((listener) => listener());
  }, [key, fallback]);

  return [value, toggle] as const;
};
