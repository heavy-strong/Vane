const modifierKeys = new Set(['Control', 'Alt', 'Shift', 'Meta']);

const keyFromEvent = (event: KeyboardEvent) => {
  if (event.code === 'Space') return 'Space';
  if (event.code.startsWith('Key')) return event.code.slice(3);
  if (event.code.startsWith('Digit')) return event.code.slice(5);
  if (/^F\d{1,2}$/.test(event.key)) return event.key.toUpperCase();
  if (event.key === 'Escape') return 'Escape';
  if (event.key === 'Tab') return 'Tab';
  if (event.key === 'Enter') return 'Enter';
  if (event.code && event.code !== 'Unidentified') return event.code;
  return event.key.length === 1 ? event.key.toUpperCase() : event.key;
};

/** Turns a browser keyboard event into the persisted shortcut format. */
export const shortcutFromEvent = (event: KeyboardEvent) => {
  if (modifierKeys.has(event.key)) return null;

  const modifiers = [
    event.ctrlKey && 'Ctrl',
    event.altKey && 'Alt',
    event.shiftKey && 'Shift',
    event.metaKey && 'Meta',
  ].filter(Boolean);
  const key = keyFromEvent(event);

  return modifiers.length > 0 && key ? [...modifiers, key].join('+') : null;
};

/** Checks a persisted shortcut against a browser keyboard event. */
export const shortcutMatches = (event: KeyboardEvent, shortcut: string) => {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.at(-1);

  if (!key || parts.length < 2) return false;

  const modifiers = new Set(parts.slice(0, -1));
  const wantsCtrl = modifiers.has('ctrl') || modifiers.has('control');
  const wantsMeta =
    modifiers.has('meta') || modifiers.has('cmd') || modifiers.has('command');
  const wantsAlt = modifiers.has('alt') || modifiers.has('option');
  const wantsShift = modifiers.has('shift');

  if (
    event.ctrlKey !== wantsCtrl ||
    event.metaKey !== wantsMeta ||
    event.altKey !== wantsAlt ||
    event.shiftKey !== wantsShift
  ) {
    return false;
  }

  const normalizedKey = key === 'space' ? ' ' : key;
  if (event.key.toLowerCase() === normalizedKey) return true;

  if (/^[a-z]$/.test(normalizedKey)) {
    return event.code === `Key${normalizedKey.toUpperCase()}`;
  }
  if (/^\d$/.test(normalizedKey)) return event.code === `Digit${normalizedKey}`;

  return event.code.toLowerCase() === key.replace(/\s/g, '');
};
