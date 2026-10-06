import fs from 'node:fs';
import path from 'node:path';
import {
  isPreferenceKey,
  MAX_PREFERENCE_LENGTH,
  PreferenceSnapshot,
  PreferenceValues,
} from './keys';

type Listener = (snapshot: PreferenceSnapshot) => void;

/** Server copy of the shared client preferences, persisted next to config.json. */
class PreferenceStore {
  private file = path.join(
    process.env.DATA_DIR || process.cwd(),
    'data',
    'preferences.json',
  );
  private snapshot: PreferenceSnapshot = { revision: 0, values: {} };
  private listeners = new Set<Listener>();

  constructor() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const values: PreferenceValues = {};
      for (const [key, value] of Object.entries(data?.values ?? {})) {
        if (isPreferenceKey(key) && typeof value === 'string')
          values[key] = value;
      }
      this.snapshot = {
        revision: Number.isInteger(data?.revision) ? data.revision : 0,
        values,
      };
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        console.error('Failed to read preferences:', error);
      }
    }
  }

  get(): PreferenceSnapshot {
    return {
      revision: this.snapshot.revision,
      values: { ...this.snapshot.values },
    };
  }

  /** Applies `{ key: value }` (null removes). Unknown keys and oversized values are rejected. */
  patch(changes: Record<string, unknown>): PreferenceSnapshot {
    const values = { ...this.snapshot.values };
    let changed = false;
    for (const [key, value] of Object.entries(changes)) {
      if (!isPreferenceKey(key)) throw new Error(`Unknown preference: ${key}`);
      if (value === null) {
        if (key in values) {
          delete values[key];
          changed = true;
        }
      } else if (
        typeof value === 'string' &&
        value.length <= MAX_PREFERENCE_LENGTH
      ) {
        if (values[key] !== value) {
          values[key] = value;
          changed = true;
        }
      } else {
        throw new Error(`Invalid value for preference: ${key}`);
      }
    }
    if (!changed) return this.get();

    this.snapshot = { revision: this.snapshot.revision + 1, values };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(
      `${this.file}.tmp`,
      JSON.stringify(this.snapshot, null, 2),
    );
    fs.renameSync(`${this.file}.tmp`, this.file);

    const snapshot = this.get();
    this.listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// One instance per server process: route handlers may be bundled separately (notably in dev).
const globalStore = globalThis as typeof globalThis & {
  __vanePreferenceStore?: PreferenceStore;
};
const preferenceStore = (globalStore.__vanePreferenceStore ??=
  new PreferenceStore());

export default preferenceStore;
