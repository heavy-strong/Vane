const MAX_QUOTE_LENGTH = 2000;

export const normalizeQuote = (text: string) => {
  const trimmed = text.replace(/\n{3,}/g, '\n\n').trim();
  return trimmed.length > MAX_QUOTE_LENGTH
    ? `${trimmed.slice(0, MAX_QUOTE_LENGTH)}…`
    : trimmed;
};

export const buildQuotedMessage = (quote: string, message: string) => {
  const quoted = normalizeQuote(quote)
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n');

  return `${quoted}\n\n${message}`;
};

export const parseQuotedMessage = (
  query: string,
): { quote: string | null; message: string } => {
  const lines = query.split('\n');
  let i = 0;

  while (i < lines.length && /^>( |$)/.test(lines[i])) i++;

  if (i === 0 || i === lines.length) return { quote: null, message: query };

  return {
    quote: lines
      .slice(0, i)
      .map((line) => line.replace(/^> ?/, ''))
      .join('\n')
      .trim(),
    message: lines.slice(i).join('\n').trim(),
  };
};
