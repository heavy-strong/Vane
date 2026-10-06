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

const TABLE_ROW_PATTERN = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR_PATTERN = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/**
 * Makes GFM tables survive a paste into Obsidian (and other markdown
 * editors): block math inside a cell is collapsed to inline `$...$` so the row
 * isn't split across lines, literal `|` inside link URLs / inline math is
 * escaped so it doesn't create phantom columns, and tables are surrounded by
 * blank lines, which Obsidian requires to recognise them.
 *
 * Must run BEFORE `normalizeMathDelimiters`, which would otherwise expand
 * `\[...\]` inside a row into a multi-line `$$` block.
 */
export const formatTablesForCopy = (text: string) => {
  const lines = text.split('\n');
  const out: string[] = [];
  let inFence = false;

  const isTableStart = (i: number) =>
    TABLE_ROW_PATTERN.test(lines[i]) &&
    i + 1 < lines.length &&
    TABLE_SEPARATOR_PATTERN.test(lines[i + 1]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;

    if (inFence || !isTableStart(i)) {
      out.push(line);
      continue;
    }

    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');

    while (i < lines.length && TABLE_ROW_PATTERN.test(lines[i])) {
      out.push(
        lines[i]
          .replace(/\\\[([\s\S]+?)\\\]/g, (_, tex) => `$${tex.trim()}$`)
          .replace(/\$\$([^$]+?)\$\$/g, (_, tex) => `$${tex.trim()}$`)
          .replace(/(\]\()([^)\s]*)(\))/g, (_, a, url: string, b) =>
            `${a}${url.replace(/(?<!\\)\|/g, '%7C')}${b}`,
          )
          .replace(/(<citation href=")([^"]*)(")/g, (_, a, url: string, b) =>
            `${a}${url.replace(/\|/g, '%7C')}${b}`,
          )
          .replace(/(?<!\\)\$([^$\n]+?)\$/g, (m, tex: string) =>
            `$${tex.replace(/(?<!\\)\|/g, '\\vert ')}$`,
          ),
      );
      i++;
    }
    i--;

    if (i + 1 < lines.length && lines[i + 1].trim() !== '') out.push('');
  }

  return out.join('\n');
};
