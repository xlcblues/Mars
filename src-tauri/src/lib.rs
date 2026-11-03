mod commands;
mod core;

use std::sync::Mutex;

use tauri::Manager;

use commands::{
    ai, analytics, attachments, backup, dashboard, entries, projects, reports, AppState,
};
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            let db_path = app_data.join("mars.db");
            let attachments_root = app_data.join("attachments");

            let db = Database::open(&db_path)?;
            let attachments = Attachments::new(attachments_root.clone())?;
            app.manage(AppState {
                db: Mutex::new(db),
                attachments,
                db_path,
                attachments_root,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            ai::get_ai_config,
            ai::save_ai_config,
            ai::test_ai_connection,
            ai::list_ai_sessions,
            ai::get_ai_session,
            ai::save_ai_session,
            ai::delete_ai_session,
            ai::list_ai_tool_logs,
            ai::ai_apply_actions,
            ai::ai_chat_stream,
            ai::ai_polish_report_stream,
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
            backup::local_data_info,
            backup::create_backup,
            backup::restore_backup,
            dashboard::dashboard_summary,
            dashboard::week_trend,
            dashboard::project_overview,
            dashboard::week_range,
            analytics::analytics_summary,
            analytics::daily_trend,
            analytics::project_share,
            analytics::export_analytics,
            reports::list_report_templates,
            reports::save_report_template,
            reports::delete_report_template,
            reports::render_report,
            reports::export_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
