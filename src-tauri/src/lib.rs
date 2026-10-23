#[tauri::command]
fn app_info() -> serde_json::Value {
    serde_json::json!({
        "name": "Mars",
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
