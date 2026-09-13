# Vane Desktop

A thin native shell (Tauri v2) around a self-hosted Vane instance. It adds what a browser tab can't:

- **Global shortcut** — press `Alt+Shift+Space` (configurable) anywhere to open a new Vane question, with the chat input focused.
- **Tray icon** — Show/Hide, New question, Settings, Quit.
- **Close to tray** — closing the window hides it; the shortcut keeps working.
- **Single instance** — launching it again just focuses the existing window.

The Vane server itself is _not_ bundled. Run Vane as usual (Docker or `npm start`) and point the desktop app at it.

## Prerequisites

- [Rust](https://rustup.rs) (stable)
- Platform deps from the [Tauri prerequisites guide](https://tauri.app/start/prerequisites/)
  - Windows: Visual Studio C++ Build Tools + WebView2 (preinstalled on Windows 10/11)
  - macOS: Xcode Command Line Tools
  - Linux: `webkit2gtk-4.1`, `libayatana-appindicator3` etc.
- Node.js (for the Tauri CLI)

## Development

```bash
cd desktop
npm install
npm run dev
```

On first launch the window shows a settings page. Enter your server URL (e.g. `http://localhost:3000`), click **New question (global)**, and press the shortcut you want. The page explains that this global shortcut opens a fresh chat from anywhere; press **Save & connect** to apply it.

Settings are stored in the platform config dir:

Once connected, open **Vane Settings → Keyboard shortcuts → New question** inside the desktop app. This shows the actual global shortcut (initially `Alt+Shift+Space`) and changes the same native setting used by the desktop settings window. Changes apply immediately and survive restarting the app. The desktop app handles this action once, including when its web page is focused. In a standalone browser, the setting only applies within Vane.

Recording temporarily releases the global shortcut so its current combination can be recorded too. Escape, leaving the field, closing the settings, or changing windows restores it. A failed registration or save retains the previous setting and reports the error.

The [Tauri capability system](https://tauri.app/security/capabilities/) grants the configured server origin access to only the shortcut read, write, and recording commands. Full desktop configuration and core system APIs remain available only to the bundled settings page. Native commands also verify the current server origin and the IPC permission scope, so previously configured origins cannot change the current server's shortcut.

| OS      | Path                                                           |
| ------- | -------------------------------------------------------------- |
| Windows | `%APPDATA%\app.vane.desktop\settings.json`                     |
| macOS   | `~/Library/Application Support/app.vane.desktop/settings.json` |
| Linux   | `~/.config/app.vane.desktop/settings.json`                     |

## Building installers

To run the browser integration checks against a local Vane development server, use `npm run test:shortcuts -- http://localhost:3000` from `desktop/`. These checks simulate the Tauri transport and cover the web settings without changing native or server configuration.

```bash
npm run build
```

Artifacts land in `src-tauri/target/release/bundle/` (`.msi`/`.exe` on Windows, `.dmg`/`.app` on macOS, `.deb`/`.AppImage` on Linux).

## Shortcut syntax

`Modifier+...+Key`, e.g. `Alt+Shift+Space`, `CmdOrCtrl+Shift+V`, `Super+K`.
Modifiers: `Ctrl`/`Control`, `Alt`/`Option`, `Shift`, `Super`/`Cmd`/`Command`/`Meta`, `CmdOrCtrl`/`CommandOrControl`.

## Project layout

```
desktop/
├─ ui/index.html         settings page (plain HTML, uses window.__TAURI__)
└─ src-tauri/
   ├─ src/lib.rs         window, tray, shortcut and settings logic
   ├─ tauri.conf.json    app config
   ├─ capabilities/      IPC permissions (local settings page only)
   └─ icons/             generated with `npm run icon` from ../public/icon.png
```
