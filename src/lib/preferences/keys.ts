/**
 * Client preferences shared by every Vane client (browsers, Vane Desktop, embedded views).
 * Each client keeps a localStorage copy for synchronous reads; the server copy is the source of truth.
 * Window-local UI state (sidebar expansion, the desktop-native shortcut) is intentionally not listed.
 */
export const SYNCED_PREFERENCE_KEYS = [
  'theme',
  'openLinksInBrowser',
  'measureUnit',
  'autoMediaSearch',
  'showWeatherWidget',
  'showNewsWidget',
  'decodeCitationUrls',
  'notifyOnSearchComplete',
  'systemInstructions',
  'chatModelProviderId',
  'chatModelKey',
  'embeddingModelProviderId',
  'embeddingModelKey',
  'chatReasoningEffort',
  'chatThinkingEnabled',
  'favoriteChatModels',
] as const;

export type PreferenceKey = (typeof SYNCED_PREFERENCE_KEYS)[number];
export type PreferenceValues = Partial<Record<PreferenceKey, string>>;
export type PreferenceSnapshot = { revision: number; values: PreferenceValues };

export const MAX_PREFERENCE_LENGTH = 64 * 1024;

export const isPreferenceKey = (key: unknown): key is PreferenceKey =>
  typeof key === 'string' &&
  (SYNCED_PREFERENCE_KEYS as readonly string[]).includes(key);
