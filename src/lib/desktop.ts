type DesktopShortcut = { shortcut: string; defaultShortcut: string };

declare global {
  interface Window {
    __VANE_DESKTOP__?: { version: number };
    __TAURI__?: {
      core: {
        invoke: <T>(
          command: string,
          args?: Record<string, unknown>,
        ) => Promise<T>;
      };
    };
  }
}

export const isDesktop = () =>
  typeof window !== 'undefined' && window.__VANE_DESKTOP__?.version === 1;

const invoke = <T>(command: string, args?: Record<string, unknown>) => {
  if (!isDesktop() || !window.__TAURI__) {
    return Promise.reject(new Error('The desktop connection is unavailable.'));
  }
  return window.__TAURI__.core.invoke<T>(command, args);
};

const mirrorShortcut = (settings: DesktopShortcut) => {
  const shortcut = settings.shortcut.replace(/\bSuper\b/g, 'Meta');
  try {
    localStorage.setItem('newQuestionShortcut', shortcut);
  } catch {
    // This is only a cache; the persisted native setting remains authoritative.
  }
  window.dispatchEvent(new Event('client-config-changed'));
  return {
    ...settings,
    shortcut,
    defaultShortcut: settings.defaultShortcut.replace(/\bSuper\b/g, 'Meta'),
  };
};

export const loadDesktopShortcut = async () =>
  mirrorShortcut(await invoke<DesktopShortcut>('get_desktop_shortcut'));

export const saveDesktopShortcut = async (shortcut: string) =>
  mirrorShortcut(
    await invoke<DesktopShortcut>('set_desktop_shortcut', { shortcut }),
  );

export const setDesktopShortcutRecording = (recording: boolean) =>
  isDesktop()
    ? invoke<void>('set_shortcut_recording', { recording })
    : Promise.resolve();
