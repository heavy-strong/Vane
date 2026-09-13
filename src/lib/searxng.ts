import { getSearxngURL } from './config/serverRegistry';

export interface SearxngSearchOptions {
  categories?: string[];
  engines?: string[];
  language?: string;
  pageno?: number;
}

interface SearxngSearchResult {
  title: string;
  url: string;
  img_src?: string;
  thumbnail_src?: string;
  thumbnail?: string;
  content?: string;
  author?: string;
  iframe_src?: string;
}

export interface SearxngEngine {
  name: string;
  categories: string[];
  enabled: boolean;
}

const SEARXNG_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([403, 429, 502, 503]);

let activeSearches = 0;
const waitQueue: Array<() => void> = [];

const acquireSlot = async () => {
  if (activeSearches >= SEARXNG_CONCURRENCY) {
    await new Promise<void>((resolve) => waitQueue.push(resolve));
  }
  activeSearches++;
};

const releaseSlot = () => {
  activeSearches = Math.max(0, activeSearches - 1);
  waitQueue.shift()?.();
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildSearxngUrl = (pathname: string) => {
  const searxngURL = getSearxngURL()?.trim();

  if (!searxngURL) {
    throw new Error(
      'SearXNG URL is not configured. Set it in Settings or via SEARXNG_API_URL.',
    );
  }

  const normalized = searxngURL.replace(/\/+$/, '');
  try {
    return new URL(`${normalized}${pathname}`);
  } catch {
    throw new Error(`Invalid SearXNG URL: ${searxngURL}`);
  }
};

const buildSearchUrl = (query: string, opts?: SearxngSearchOptions) => {
  const url = buildSearxngUrl('/search');

  url.searchParams.set('format', 'json');
  url.searchParams.set('q', query);

  if (opts) {
    Object.keys(opts).forEach((key) => {
      const value = opts[key as keyof SearxngSearchOptions];
      if (Array.isArray(value)) {
        url.searchParams.set(key, value.join(','));
        return;
      }
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url;
};

const searxngErrorMessage = (status: number, statusText: string) => {
  if (status === 403) {
    return (
      'SearXNG error: Forbidden. Enable JSON in SearXNG settings.yml ' +
      '(search.formats: [html, json]), relax the limiter for local API use, and restart SearXNG.'
    );
  }
  if (status === 429) {
    return 'SearXNG error: Too Many Requests. Disable or relax the SearXNG limiter for local API use.';
  }
  return `SearXNG error: ${status} ${statusText}`;
};

export const searchSearxng = async (
  query: string,
  opts?: SearxngSearchOptions,
) => {
  const url = buildSearchUrl(query, opts);

  await acquireSlot();

  try {
    let lastStatus = 0;
    let lastStatusText = '';

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent':
              'Mozilla/5.0 (compatible; Vane/1.12.2; +https://github.com/ItzCrazyKns/Vane)',
          },
        });

        if (res.ok) {
          const data = await res.json();

          const results: SearxngSearchResult[] = Array.isArray(data?.results)
            ? data.results
            : [];
          const suggestions: string[] = Array.isArray(data?.suggestions)
            ? data.suggestions
            : [];

          return { results, suggestions };
        }

        lastStatus = res.status;
        lastStatusText = res.statusText;

        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
          await sleep(400 * 2 ** attempt);
          continue;
        }

        throw new Error(searxngErrorMessage(res.status, res.statusText));
      } catch (err: any) {
        if (err.name === 'AbortError') {
          if (attempt < MAX_RETRIES) {
            await sleep(400 * 2 ** attempt);
            continue;
          }
          throw new Error('SearXNG search timed out');
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw new Error(searxngErrorMessage(lastStatus, lastStatusText));
  } finally {
    releaseSlot();
  }
};

const ENGINES_CACHE_TTL = 5 * 60 * 1000;
let enginesCache: {
  url: string;
  fetchedAt: number;
  engines: SearxngEngine[];
} | null = null;

/* Lists engines known to the SearXNG instance (via its `/config` endpoint).
 * `enabled` reflects SearXNG's default engine set; disabled engines can still be
 * requested explicitly through the `engines` search parameter. */
export const getSearxngEngines = async (): Promise<SearxngEngine[]> => {
  const url = buildSearxngUrl('/config');

  if (
    enginesCache &&
    enginesCache.url === url.toString() &&
    Date.now() - enginesCache.fetchedAt < ENGINES_CACHE_TTL
  ) {
    return enginesCache.engines;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(searxngErrorMessage(res.status, res.statusText));
    }

    const data = await res.json();
    const engines: SearxngEngine[] = Array.isArray(data?.engines)
      ? data.engines
          .filter((e: any) => typeof e?.name === 'string')
          .map((e: any) => ({
            name: e.name,
            categories: Array.isArray(e.categories) ? e.categories : [],
            enabled: e.enabled === true,
          }))
      : [];

    enginesCache = { url: url.toString(), fetchedAt: Date.now(), engines };
    return engines;
  } finally {
    clearTimeout(timeoutId);
  }
};
