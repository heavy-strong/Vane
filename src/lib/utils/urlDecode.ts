const URL_PATTERN = /https?:\/\/[^\s\]\)}>"'`]+/g;
const CITATION_TAG_PATTERN = /<citation href="([^"]*)">([^<]*)<\/citation>/g;

const isDecodeCitationUrlsEnabled = () => {
  if (typeof localStorage === 'undefined') return true;
  return (localStorage.getItem('decodeCitationUrls') ?? 'true') === 'true';
};

const safeDecodeURI = (url: string) => {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
};

/** Decodes every percent-encoded URL found inside a block of text. */
export const decodeUrlsInText = (text: string, enabled = true) => {
  if (!enabled) return text;
  return text.replace(URL_PATTERN, safeDecodeURI);
};

/**
 * Rewrites raw `<citation href="...">N</citation>` tags (as they appear in
 * the unparsed markdown answer) into plain markdown links, e.g. `[N](url)`,
 * decoding the URL. Adjacent citations render as `[1](url1)[7](url2)`
 * instead of the ambiguous, unreadable "17" they'd otherwise produce when
 * copied as-is - and the resulting markdown link is what tools like Obsidian
 * expect instead of a stray HTML tag.
 */
export const formatCitationsForCopy = (text: string, decode = true) =>
  text.replace(CITATION_TAG_PATTERN, (_match, href: string, label: string) =>
    `[${label}](${decode ? safeDecodeURI(href) : href})`,
  );

/** Applies both citation-tag rewriting and stray-URL decoding, respecting the
 * user's "Decode citation URLs" preference. */
export const formatMessageForCopy = (text: string) => {
  const decode = isDecodeCitationUrlsEnabled();
  return decodeUrlsInText(formatCitationsForCopy(text, decode), decode);
};

export { isDecodeCitationUrlsEnabled, safeDecodeURI, URL_PATTERN };
