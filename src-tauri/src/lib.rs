mod commands;
mod core;

use std::sync::Mutex;

use tauri::Manager;

use commands::{analytics, attachments, dashboard, entries, projects, AppState};
use core::attachments::Attachments;
use core::db::Database;

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
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            let db_path = app_data.join("mars.db");
            let attachments_root = app_data.join("attachments");

            let db = Database::open(&db_path)?;
            let attachments = Attachments::new(attachments_root)?;
            app.manage(AppState {
                db: Mutex::new(db),
                attachments,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            projects::list_projects,
            projects::create_project,
            projects::update_project,
            projects::archive_project,
            projects::restore_project,
            entries::list_entries,
            entries::save_entry,
            entries::delete_entry,
            attachments::add_attachment,
            attachments::list_attachments,
            attachments::open_attachment,
            attachments::delete_attachment,
            dashboard::dashboard_summary,
            dashboard::week_trend,
            dashboard::project_overview,
            dashboard::week_range,
            analytics::analytics_summary,
            analytics::daily_trend,
            analytics::project_share,
            analytics::export_analytics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
