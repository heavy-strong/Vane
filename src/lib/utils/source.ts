import { Chunk } from '@/lib/types';

export const isFileSource = (source: Chunk) =>
  String(source.metadata?.url ?? '').startsWith('file_id://');

/** `https://www.blog.naver.com/x` -> `blog.naver.com` */
export const sourceHost = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^[a-z]+:\/\//i, '').split('/')[0];
  }
};

export const sourceSiteName = (source: Chunk) =>
  isFileSource(source)
    ? source.metadata.fileName || 'Uploaded file'
    : sourceHost(source.metadata.url);

export const sourceTitle = (source: Chunk) =>
  source.metadata.title || sourceSiteName(source);

export const faviconUrl = (url: string) =>
  `https://s2.googleusercontent.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=32`;

/** A short plain-text excerpt of the chunk, which may hold scraped markdown. */
export const sourceSnippet = (source: Chunk, max = 220) => {
  const text = (source.content ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};
