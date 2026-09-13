fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_settings",
            "save_settings",
            "get_desktop_shortcut",
            "set_desktop_shortcut",
            "set_shortcut_recording",
        ]),
    ))
    .expect("Failed to build desktop permissions");
}
