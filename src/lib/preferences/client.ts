'use client';

import {
  isPreferenceKey,
  PreferenceKey,
  PreferenceSnapshot,
  SYNCED_PREFERENCE_KEYS,
} from './keys';

/**
 * Shared client preferences. localStorage is this client's synchronous cache; writes go to the
 * server (`/api/preferences`) and changes made by other clients (another browser, Vane Desktop)
 * arrive over `/api/preferences/events` and are written back into the cache.
 */
export const PREFERENCES_CHANGED_EVENT = 'preferences-changed';
export type PreferencesChangedDetail = { keys: string[]; remote: boolean };

// Events existing components already listen to, fired when another client changes their keys.
const FAVORITES_CHANGED_EVENT = 'favorite-chat-models-changed';
const CLIENT_CONFIG_KEYS: string[] = [
  'theme',
  'openLinksInBrowser',
  'measureUnit',
  'autoMediaSearch',
  'showWeatherWidget',
  'showNewsWidget',
  'decodeCitationUrls',
  'notifyOnSearchComplete',
  'systemInstructions',
];

let revision = -1;
const pending = new Map<PreferenceKey, string | null>(); // Not yet sent.
const inFlight = new Set<PreferenceKey>(); // Sent, not yet acknowledged.
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let started: Promise<void> | null = null;

const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocal = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
};

const notify = (keys: string[], remote: boolean) => {
  if (!keys.length || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<PreferencesChangedDetail>(PREFERENCES_CHANGED_EVENT, {
      detail: { keys, remote },
    }),
  );
  if (!remote) return;
  if (keys.includes('favoriteChatModels')) {
    window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT));
  }
  if (keys.some((key) => CLIENT_CONFIG_KEYS.includes(key))) {
    window.dispatchEvent(new Event('client-config-changed'));
  }
};

export const getPreference = (key: string) => readLocal(key);

/** Sets (or with null, removes) a preference here and on the server. Unsynced keys stay local. */
export const setPreference = (key: string, value: string | null) => {
  if (readLocal(key) === value) return;
  writeLocal(key, value);
  if (isPreferenceKey(key)) {
    pending.set(key, value);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 50);
  }
  notify([key], false);
};

export const removePreference = (key: string) => setPreference(key, null);

const send = async (values: Record<string, string | null>) => {
  const res = await fetch('/api/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) throw new Error(`Saving preferences failed (${res.status})`);
  return (await res.json()) as PreferenceSnapshot;
};

async function flush() {
  if (!pending.size) return;
  const values = Object.fromEntries(pending) as Record<string, string | null>;
  const keys = [...pending.keys()];
  pending.clear();
  keys.forEach((key) => inFlight.add(key));
  try {
    const snapshot = await send(values);
    keys.forEach((key) => inFlight.delete(key));
    apply(snapshot, false);
  } catch (error) {
    console.error('Could not save preferences; retrying.', error);
    keys.forEach((key) => {
      inFlight.delete(key);
      if (!pending.has(key)) pending.set(key, values[key]);
    });
    flushTimer = setTimeout(flush, 5000);
  }
}

/**
 * Writes a server snapshot into the cache, skipping keys with local writes still on their way.
 * Snapshots from the event stream are in server order (`authoritative`); a save response may be
 * older than one already applied, so it only applies if its revision is not behind.
 */
function apply(snapshot: PreferenceSnapshot, authoritative: boolean) {
  if (!authoritative && snapshot.revision < revision) return;
  revision = snapshot.revision;
  const changed: PreferenceKey[] = [];
  for (const key of SYNCED_PREFERENCE_KEYS) {
    if (pending.has(key) || inFlight.has(key)) continue;
    const value = snapshot.values[key] ?? null;
    if (readLocal(key) !== value) {
      writeLocal(key, value);
      changed.push(key);
    }
  }
  notify(changed, true);
}

const connect = () => {
  if (typeof EventSource === 'undefined') return;
  const events = new EventSource('/api/preferences/events');
  events.onmessage = (event) => {
    try {
      apply(JSON.parse(event.data), true);
    } catch (error) {
      console.error('Invalid preferences event', error);
    }
  };
  // EventSource reconnects by itself; the snapshot sent on reconnect catches up on missed changes.
};

// Marks (in this client's own storage) that its pre-sync settings were merged into the server copy.
const MERGED_KEY = 'preferencesMerged';

const parseList = (value: string | null | undefined): unknown[] => {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * What a client that has never synced adds to the server copy: its settings for keys the server
 * does not have yet, and its favorite models joined with the server's. The server wins otherwise.
 */
export const mergeLocalPreferences = (
  server: PreferenceSnapshot['values'],
  local: Partial<Record<PreferenceKey, string | null>>,
) => {
  const changes: Record<string, string> = {};
  for (const key of SYNCED_PREFERENCE_KEYS) {
    const value = local[key];
    if (value == null) continue;
    if (key === 'favoriteChatModels' && server[key] !== undefined) {
      const seen = new Set<string>();
      const joined = [...parseList(server[key]), ...parseList(value)].filter(
        (item) => {
          const id = JSON.stringify(item);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        },
      );
      if (joined.length !== parseList(server[key]).length) {
        changes[key] = JSON.stringify(joined);
      }
    } else if (server[key] === undefined) {
      changes[key] = value;
    }
  }
  return changes;
};

/** Loads the shared preferences into the cache once per page, then follows changes. */
export const startPreferenceSync = () =>
  (started ??= (async () => {
    try {
      const res = await fetch('/api/preferences', { cache: 'no-store' });
      if (!res.ok)
        throw new Error(`Loading preferences failed (${res.status})`);
      let snapshot = (await res.json()) as PreferenceSnapshot;
      if (!readLocal(MERGED_KEY)) {
        const local = Object.fromEntries(
          SYNCED_PREFERENCE_KEYS.map((key) => [key, readLocal(key)]),
        );
        const changes = mergeLocalPreferences(snapshot.values, local);
        if (Object.keys(changes).length) snapshot = await send(changes);
        writeLocal(MERGED_KEY, String(Date.now()));
      }
      apply(snapshot, true);
    } catch (error) {
      console.error(
        "Could not load shared preferences; using this device's copy.",
        error,
      );
    } finally {
      connect();
    }
  })());
