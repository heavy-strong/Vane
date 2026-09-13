import {
  getImageEngines,
  getKoreanEngines,
  getVideoEngines,
  getWebEngines,
  isKoreanBoostEnabled,
} from './config/serverRegistry';
import { getSearxngEngines, SearxngSearchOptions } from './searxng';

export type SearchKind = 'web' | 'images' | 'videos';

/* Hangul Jamo, Compatibility Jamo and Hangul Syllables */
const HANGUL_RE = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;

export const containsHangul = (text: string) => HANGUL_RE.test(text);

/* Naver engines that map onto each search kind. `koreanEngines` (user
 * configurable) covers the web kind; media kinds use the fixed Naver
 * counterparts. */
const KOREAN_MEDIA_ENGINES: Record<Exclude<SearchKind, 'web'>, string[]> = {
  images: ['naver images'],
  videos: ['naver videos'],
};

const SEARXNG_CATEGORY: Record<SearchKind, string> = {
  web: 'general',
  images: 'images',
  videos: 'videos',
};

const unique = (arr: string[]) => [...new Set(arr)];

/* Engines SearXNG would use on its own for the category. Needed when the user
 * hasn't picked web engines but we want to *add* Korean engines rather than
 * replace the defaults (passing `engines=` to SearXNG overrides its defaults). */
const getSearxngDefaultEngines = async (kind: SearchKind) => {
  try {
    const engines = await getSearxngEngines();
    return engines
      .filter((e) => e.enabled && e.categories.includes(SEARXNG_CATEGORY[kind]))
      .map((e) => e.name);
  } catch (err) {
    console.warn('Could not fetch SearXNG engine list:', err);
    return [];
  }
};

/* Builds the SearXNG options (engines/language) for a query, applying the
 * user's engine selection and the Korean boost. `originalQuery` is the user's
 * own text; pass it when `query` was rewritten by an LLM (often into English)
 * so Korean detection still sees what the user typed. */
export const resolveSearchOptions = async (
  query: string,
  kind: SearchKind,
  originalQuery?: string,
): Promise<SearxngSearchOptions> => {
  const configured =
    kind === 'web'
      ? getWebEngines()
      : kind === 'images'
        ? getImageEngines()
        : getVideoEngines();

  const korean =
    isKoreanBoostEnabled() &&
    (containsHangul(query) || containsHangul(originalQuery ?? ''));

  const opts: SearxngSearchOptions = {};

  if (!korean) {
    if (configured.length > 0) opts.engines = configured;
    return opts;
  }

  opts.language = 'ko';

  const koreanEngines =
    kind === 'web' ? getKoreanEngines() : KOREAN_MEDIA_ENGINES[kind];

  const base =
    configured.length > 0 ? configured : await getSearxngDefaultEngines(kind);

  const engines = unique([...base, ...koreanEngines]);

  /* If we know nothing about the defaults and have nothing to add, let SearXNG
   * decide (Naver is enabled there when using the bundled settings.yml). */
  if (engines.length > 0) opts.engines = engines;

  return opts;
};
