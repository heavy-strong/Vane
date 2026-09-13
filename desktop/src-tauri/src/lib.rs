//! Vane desktop shell.
//!
//! The app does not bundle the Vane server. It is a thin WebView that points at
//! a self-hosted Vane instance and adds what a browser tab cannot provide:
//! a system-wide keyboard shortcut that summons the window, a tray icon and
//! close-to-tray behaviour.

use std::{collections::HashSet, fs, path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::{
    ipc::{CapabilityBuilder, CommandScope},
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

const MAIN_WINDOW: &str = "main";
const SETTINGS_WINDOW: &str = "settings";
const DEFAULT_SHORTCUT: &str = "Alt+Shift+Space";

/// Focuses the chat input once the window is brought to the front so the user
/// can start typing right away, like a launcher.
const FOCUS_INPUT_JS: &str =
    "(() => { const el = document.querySelector('textarea'); if (el) el.focus(); })();";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Base URL of the Vane server, e.g. `http://localhost:3000`.
    #[serde(default)]
    pub server_url: String,
    /// Global accelerator that opens a new question, e.g. `Alt+Shift+Space`.
    #[serde(default = "default_shortcut")]
    pub shortcut: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            server_url: String::new(),
            shortcut: default_shortcut(),
        }
    }
}

fn default_shortcut() -> String {
    DEFAULT_SHORTCUT.to_string()
}

type SettingsState = Mutex<Settings>;
type RecordingState = Mutex<Option<String>>;
type TrustedOrigins = Mutex<HashSet<String>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ServerScope {
    origin: String,
}

const DESKTOP_BRIDGE_JS: &str =
    "Object.defineProperty(window, '__VANE_DESKTOP__', { value: Object.freeze({ version: 1 }) });";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopShortcut {
    shortcut: String,
    default_shortcut: String,
}

fn allow_server_shortcut_access(app: &AppHandle, url: &Url) -> tauri::Result<()> {
    let origin = url.origin().ascii_serialization();
    let mut origins = app.state::<TrustedOrigins>().inner().lock().unwrap();
    if origins.contains(&origin) {
        return Ok(());
    }
    let scope = vec![ServerScope {
        origin: origin.clone(),
    }];
    app.add_capability(
        CapabilityBuilder::new(format!("vane-shortcuts-{}", origins.len()))
            .window(MAIN_WINDOW)
            .local(false)
            .remote(format!("{origin}/*"))
            .permission_scoped(
                "allow-get-desktop-shortcut",
                scope.clone(),
                Vec::<ServerScope>::new(),
            )
            .permission_scoped(
                "allow-set-desktop-shortcut",
                scope.clone(),
                Vec::<ServerScope>::new(),
            )
            .permission_scoped(
                "allow-set-shortcut-recording",
                scope,
                Vec::<ServerScope>::new(),
            ),
    )?;
    origins.insert(origin);
    Ok(())
}

fn check_server_window(
    app: &AppHandle,
    window: &WebviewWindow,
    scope: &CommandScope<ServerScope>,
) -> Result<(), String> {
    let settings = app.state::<SettingsState>().inner().lock().unwrap();
    let server = parse_server_url(&settings.server_url)?;
    if window.label() != MAIN_WINDOW
        || window.url().map_err(|e| e.to_string())?.origin() != server.origin()
        || !scope
            .allows()
            .iter()
            .any(|allowed| allowed.origin == server.origin().ascii_serialization())
    {
        return Err("Shortcut access is limited to the configured Vane server".into());
    }
    Ok(())
}

fn broadcast_shortcut_changed(app: &AppHandle) {
    for label in [MAIN_WINDOW, SETTINGS_WINDOW] {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.eval("window.dispatchEvent(new Event('desktop-shortcut-changed'));");
        }
    }
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|e| e.to_string())
}

fn load_settings(app: &AppHandle) -> Settings {
    settings_path(app)
        .ok()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn persist_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    let temporary = path.with_extension("json.tmp");
    let result = fs::write(&temporary, raw).and_then(|_| fs::rename(&temporary, &path));
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result.map_err(|e| e.to_string())
}

fn parse_server_url(raw: &str) -> Result<Url, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err("Server URL is required".into());
    }
    let url = Url::parse(trimmed).map_err(|e| format!("Invalid server URL: {e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        other => Err(format!("Unsupported URL scheme: {other}")),
    }
}

fn parse_shortcut(accelerator: &str) -> Result<Shortcut, String> {
    let shortcut: Shortcut = accelerator
        .trim()
        .parse()
        .map_err(|e| format!("Invalid shortcut \"{accelerator}\": {e}"))?;
    if shortcut.mods.is_empty() {
        return Err("Include a modifier and another key".into());
    }
    Ok(shortcut)
}

fn register_shortcut(app: &AppHandle, accelerator: &str) -> Result<(), String> {
    let shortcut = parse_shortcut(accelerator)?;

    let manager = app.global_shortcut();
    if manager.is_registered(shortcut) {
        return Ok(());
    }
    manager
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                // The plugin holds its shortcut registry lock while calling handlers.
                // Defer window/state work so changing keys cannot deadlock with this callback.
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let handle = app.clone();
                    let _ = app.run_on_main_thread(move || {
                        let recording = handle.state::<RecordingState>().lock().unwrap().is_some();
                        if !recording {
                            open_new_question(&handle);
                        }
                    });
                });
            }
        })
        .map_err(|e| format!("Could not register shortcut \"{accelerator}\": {e}"))
}

/// Register first, then persist. A rejected key or disk write keeps the old setting usable.
fn apply_settings(app: &AppHandle, next: Settings) -> Result<(), String> {
    let mut current = app.state::<SettingsState>().inner().lock().unwrap();
    let next_key = parse_shortcut(&next.shortcut)?;
    let old_key = parse_shortcut(&current.shortcut).ok();
    let was_registered = app.global_shortcut().is_registered(next_key);
    register_shortcut(app, &next.shortcut)?;
    if let Err(error) = persist_settings(app, &next) {
        if !was_registered {
            let _ = app.global_shortcut().unregister(next_key);
        }
        return Err(error);
    }
    if let Some(old_key) = old_key.filter(|key| *key != next_key) {
        if app.global_shortcut().is_registered(old_key) {
            if let Err(error) = app.global_shortcut().unregister(old_key) {
                let _ = persist_settings(app, &current);
                if !was_registered {
                    let _ = app.global_shortcut().unregister(next_key);
                }
                return Err(error.to_string());
            }
        }
    }
    *current = next;
    *app.state::<RecordingState>().lock().unwrap() = None;
    drop(current);
    broadcast_shortcut_changed(app);
    Ok(())
}

fn resume_shortcut(app: &AppHandle, label: &str) -> Result<(), String> {
    let settings = app.state::<SettingsState>().inner().lock().unwrap();
    let mut recording = app.state::<RecordingState>().inner().lock().unwrap();
    if recording.as_deref() == Some(label) {
        register_shortcut(app, &settings.shortcut)?;
        *recording = None;
    }
    Ok(())
}

#[tauri::command]
fn get_desktop_shortcut(
    app: AppHandle,
    window: WebviewWindow,
    scope: CommandScope<ServerScope>,
) -> Result<DesktopShortcut, String> {
    check_server_window(&app, &window, &scope)?;
    Ok(DesktopShortcut {
        shortcut: app
            .state::<SettingsState>()
            .lock()
            .unwrap()
            .shortcut
            .clone(),
        default_shortcut: default_shortcut(),
    })
}

#[tauri::command]
fn set_desktop_shortcut(
    app: AppHandle,
    window: WebviewWindow,
    scope: CommandScope<ServerScope>,
    shortcut: String,
) -> Result<DesktopShortcut, String> {
    check_server_window(&app, &window, &scope)?;
    let mut next = app.state::<SettingsState>().lock().unwrap().clone();
    next.shortcut = shortcut
        .split('+')
        .map(|part| match part.trim() {
            "Meta" => "Super",
            other => other,
        })
        .collect::<Vec<_>>()
        .join("+");
    apply_settings(&app, next)?;
    get_desktop_shortcut(app, window, scope)
}

#[tauri::command]
fn set_shortcut_recording(
    app: AppHandle,
    window: WebviewWindow,
    scope: CommandScope<ServerScope>,
    recording: bool,
) -> Result<(), String> {
    let url = window.url().map_err(|e| e.to_string())?;
    let bundled = scope.allows().is_empty()
        && (url.scheme() == "tauri" || url.host_str() == Some("tauri.localhost"));
    if !bundled {
        check_server_window(&app, &window, &scope)?;
    }
    if !recording {
        return resume_shortcut(&app, window.label());
    }
    let settings = app.state::<SettingsState>().inner().lock().unwrap();
    let mut owner = app.state::<RecordingState>().inner().lock().unwrap();
    if owner.is_some() && owner.as_deref() != Some(window.label()) {
        return Err("A shortcut is already being recorded in another settings window".into());
    }
    let key = parse_shortcut(&settings.shortcut)?;
    if app.global_shortcut().is_registered(key) {
        app.global_shortcut()
            .unregister(key)
            .map_err(|e| e.to_string())?;
    }
    *owner = Some(window.label().to_string());
    Ok(())
}

fn show_window(window: &WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    // Windows refuses to raise a window from a background process; briefly
    // pinning it on top is the usual way launchers get past that.
    let _ = window.set_always_on_top(true);
    let _ = window.set_focus();
    let _ = window.set_always_on_top(false);
    let _ = window.eval(FOCUS_INPUT_JS);
}

fn toggle_main_window(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    let focused = window.is_focused().unwrap_or(false);
    if visible && focused {
        let _ = window.hide();
    } else {
        show_window(&window);
    }
}

/// Opens the server root in the main window (a fresh chat) and brings it up.
fn open_new_question(app: &AppHandle) {
    let server_url = app
        .state::<SettingsState>()
        .lock()
        .unwrap()
        .server_url
        .clone();
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    if let Ok(url) = parse_server_url(&server_url) {
        let _ = window.navigate(url);
    }
    show_window(&window);
}

fn open_settings_window(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(SETTINGS_WINDOW) {
        show_window(&window);
        return Ok(());
    }
    let window =
        WebviewWindowBuilder::new(app, SETTINGS_WINDOW, WebviewUrl::App("index.html".into()))
            .title("Vane — Settings")
            .inner_size(480.0, 480.0)
            .resizable(false)
            .center()
            .build()?;
    show_window(&window);
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Show / Hide", true, None::<&str>)?;
    let new_question = MenuItem::with_id(app, "new", "New question", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &new_question, &settings, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Vane")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => toggle_main_window(app),
            "new" => open_new_question(app),
            "settings" => {
                let _ = open_settings_window(app);
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

#[tauri::command]
fn get_settings(app: AppHandle) -> Settings {
    app.state::<SettingsState>().lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let url = parse_server_url(&settings.server_url)?;
    let normalized = Settings {
        server_url: url.to_string(),
        shortcut: settings.shortcut.trim().to_string(),
    };

    allow_server_shortcut_access(&app, &url).map_err(|e| e.to_string())?;
    apply_settings(&app, normalized)?;

    if let Some(main) = app.get_webview_window(MAIN_WINDOW) {
        main.navigate(url).map_err(|e| e.to_string())?;
        show_window(&main);
    }
    if let Some(settings_window) = app.get_webview_window(SETTINGS_WINDOW) {
        let _ = settings_window.close();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                show_window(&window);
            }
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_desktop_shortcut,
            set_desktop_shortcut,
            set_shortcut_recording
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = load_settings(&handle);
            app.manage(Mutex::new(settings.clone()));
            app.manage(Mutex::new(None::<String>));
            app.manage(Mutex::new(HashSet::<String>::new()));
            if let Ok(url) = parse_server_url(&settings.server_url) {
                allow_server_shortcut_access(&handle, &url)?;
            }

            // Without a server URL the main window shows the settings page so
            // first launch is self-explanatory.
            let initial_url = match parse_server_url(&settings.server_url) {
                Ok(url) => WebviewUrl::External(url),
                Err(_) => WebviewUrl::App("index.html".into()),
            };

            WebviewWindowBuilder::new(&handle, MAIN_WINDOW, initial_url)
                .title("Vane")
                .inner_size(1200.0, 800.0)
                .min_inner_size(640.0, 480.0)
                .center()
                .initialization_script(DESKTOP_BRIDGE_JS)
                .on_page_load(|window, _| {
                    if let Err(error) = resume_shortcut(window.app_handle(), window.label()) {
                        eprintln!("[vane-desktop] Could not resume shortcut: {error}");
                    }
                })
                .build()?;

            if let Err(err) = register_shortcut(&handle, &settings.shortcut) {
                eprintln!("[vane-desktop] {err}");
            }

            build_tray(&handle)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::Focused(false) | WindowEvent::Destroyed) {
                if let Err(error) = resume_shortcut(window.app_handle(), window.label()) {
                    eprintln!("[vane-desktop] Could not resume shortcut: {error}");
                }
            }
            // Closing the main window only hides it; the app keeps running in
            // the tray so the global shortcut stays available.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN_WINDOW {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Vane desktop");
}
