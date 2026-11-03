use tauri::State;

use super::AppState;
use crate::core::db::{
    ReportRender, ReportTemplate, ReportTemplateInput,
};
use crate::core::AppError;

#[tauri::command]
pub fn list_report_templates(
    state: State<'_, AppState>,
    template_type: Option<String>,
) -> Result<Vec<ReportTemplate>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .list_report_templates(template_type.as_deref())
}

#[tauri::command]
pub fn save_report_template(
    state: State<'_, AppState>,
    input: ReportTemplateInput,
) -> Result<ReportTemplate, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .save_report_template(&input)
}

#[tauri::command]
pub fn delete_report_template(
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .delete_report_template(id)
}

#[tauri::command]
pub fn render_report(
    state: State<'_, AppState>,
    report_type: String,
    start_date: String,
    end_date: String,
    template_id: Option<i64>,
) -> Result<ReportRender, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .render_report(&report_type, &start_date, &end_date, template_id)
}

#[tauri::command]
pub fn export_report(
    state: State<'_, AppState>,
    format: String,
    report_type: String,
    start_date: String,
    end_date: String,
    template_id: Option<i64>,
    target_path: String,
    content: Option<String>,
) -> Result<String, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .export_report(
            &format,
            &report_type,
            &start_date,
            &end_date,
            template_id,
            &target_path,
            content,
        )
}
