// Catalog names like "Anthropic: Claude Opus 4.5" carry the vendor as a
// prefix; split it off so the model name gets the space.
export const splitModelName = (name: string) => {
  const match = name.match(/^([^:]{1,32}):\s+(.+)$/);
  return match
    ? { vendor: match[1].trim(), label: match[2].trim() }
    : { vendor: undefined, label: name };
};
