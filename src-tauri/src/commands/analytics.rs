use tauri::State;

use crate::core::db::{
    analytics_csv, analytics_json, AnalyticsSummary, DayStatPoint, ProjectShare,
};

use crate::core::AppError;
use super::AppState;

#[tauri::command]
pub fn analytics_summary(
    state: State<'_, AppState>,
    start_date: String,
    end_date: String,
    project_id: Option<i64>,
    tag: Option<String>,
) -> Result<AnalyticsSummary, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .analytics_summary(&start_date, &end_date, project_id, tag.as_deref())
}

#[tauri::command]
pub fn daily_trend(
    state: State<'_, AppState>,
    start_date: String,
    end_date: String,
    project_id: Option<i64>,
    tag: Option<String>,
) -> Result<Vec<DayStatPoint>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .daily_trend(&start_date, &end_date, project_id, tag.as_deref())
}

#[tauri::command]
pub fn project_share(
    state: State<'_, AppState>,
    start_date: String,
    end_date: String,
    project_id: Option<i64>,
    tag: Option<String>,
) -> Result<Vec<ProjectShare>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .project_share(&start_date, &end_date, project_id, tag.as_deref())
}

#[tauri::command]
pub fn export_analytics(
    state: State<'_, AppState>,
    format: String,
    start_date: String,
    end_date: String,
    project_id: Option<i64>,
    tag: Option<String>,
    target_path: String,
) -> Result<String, AppError> {
    let db = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?;
    let summary = db.analytics_summary(&start_date, &end_date, project_id, tag.as_deref())?;
    let daily = db.daily_trend(&start_date, &end_date, project_id, tag.as_deref())?;
    let projects = db.project_share(&start_date, &end_date, project_id, tag.as_deref())?;

    let content = match format.as_str() {
        "csv" => format!("\u{feff}{}", analytics_csv(&summary, &daily, &projects)),
        "json" => analytics_json(&summary, &daily, &projects),
        _ => return Err(AppError("不支持的导出格式".into())),
    };
    std::fs::write(&target_path, content).map_err(|err| AppError(format!("导出失败：{err}")))?;
    Ok(target_path)
}
