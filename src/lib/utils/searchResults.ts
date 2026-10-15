import type { Chunk } from '../types';

const sourceKey = (chunk: Chunk) => {
  try {
    const url = new URL(chunk.metadata.url);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return chunk.metadata.url || chunk.content;
  }
};

/** Keep the engine's top results even when an embedding model doesn't know a
 * new name or language. Rank the rest using both engine and semantic rank.
 * Deduplicate URLs, never independent sources with similar wording. */
export const selectSearchResults = (groups: Chunk[][], limit = 20): Chunk[] => {
  const ranked = groups.flatMap((group, queryIndex) => {
    const semantic = [...group].sort(
      (a, b) => (b.metadata.similarity ?? 0) - (a.metadata.similarity ?? 0),
    );
    return group.map((chunk, rank) => ({
      chunk,
      rank,
      queryIndex,
      score: 1 / (60 + rank + 1) + 1 / (60 + semantic.indexOf(chunk) + 1),
    }));
  });

  ranked.sort((a, b) => {
    const aProtected = a.rank < 3;
    const bProtected = b.rank < 3;
    if (aProtected !== bProtected) return aProtected ? -1 : 1;
    if (aProtected) return a.rank - b.rank || a.queryIndex - b.queryIndex;
    return b.score - a.score || a.rank - b.rank || a.queryIndex - b.queryIndex;
  });

  const seen = new Set<string>();
  const results: Chunk[] = [];
  for (const { chunk } of ranked) {
    if (results.length >= limit) break;
    const key = sourceKey(chunk);
    if (seen.has(key)) continue;
    seen.add(key);
    const { embedding, similarity, ...metadata } = chunk.metadata;
    results.push({ content: chunk.content, metadata });
  }
  return results;
};

/** The writer needs the URL and evidence type to assess source authority. */
export const formatSearchContext = (results: Chunk[]) =>
  results
    .map(
      (result, index) =>
        `<result index="${index + 1}">${JSON.stringify({
          title: result.metadata.title,
          url: result.metadata.url,
          evidence: result.metadata.evidence ?? 'search snippet',
          content: result.content,
        })}</result>`,
    )
    .join('\n');
