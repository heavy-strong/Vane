import configManager from './index';
import { ConfigModelProvider } from './types';

export const getConfiguredModelProviders = (): ConfigModelProvider[] => {
  return configManager.getConfig('modelProviders', []);
};

export const getConfiguredModelProviderById = (
  id: string,
): ConfigModelProvider | undefined => {
  return getConfiguredModelProviders().find((p) => p.id === id) ?? undefined;
};

export const getSearxngURL = () =>
  configManager.getConfig('search.searxngURL', '');

/* Reads a `search.*` setting, falling back to the default declared in the UI
 * config section so defaults live in one place. */
const getSearchSetting = <T>(key: string): T => {
  const field = configManager
    .getUIConfigSections()
    .search.find((f) => f.key === key);

  return configManager.getConfig(`search.${key}`, field?.default) as T;
};

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : [];

export const getWebEngines = () =>
  asStringArray(getSearchSetting<string[]>('webEngines'));

export const getImageEngines = () =>
  asStringArray(getSearchSetting<string[]>('imageEngines'));

export const getVideoEngines = () =>
  asStringArray(getSearchSetting<string[]>('videoEngines'));

export const getKoreanEngines = () =>
  asStringArray(getSearchSetting<string[]>('koreanEngines'));

export const isKoreanBoostEnabled = () => {
  const v = getSearchSetting<boolean | string>('koreanBoost');
  return v === true || v === 'true';
};
