use std::str::FromStr;

use chrono::{Duration, Local, NaiveDate};
use tauri::State;

use crate::core::db::{
    today_str, week_start_str, DashboardSummary, ProjectOverview, WeekTrendPoint,
};

use crate::core::AppError;
use super::AppState;

#[tauri::command]
pub fn dashboard_summary(state: State<'_, AppState>) -> Result<DashboardSummary, AppError> {
    let today = today_str();
    let week_start = week_start_str(&Local::now().date_naive());
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .dashboard_summary(&today, &week_start)
}

#[tauri::command]
pub fn week_trend(state: State<'_, AppState>) -> Result<Vec<WeekTrendPoint>, AppError> {
    let today = Local::now().date_naive();
    let week_start = week_start_str(&today);
    let start = NaiveDate::from_str(&week_start).map_err(|err| AppError(err.to_string()))?;
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .week_trend(&start)
}

#[tauri::command]
pub fn project_overview(state: State<'_, AppState>) -> Result<Vec<ProjectOverview>, AppError> {
    let today = today_str();
    let week_start = week_start_str(&Local::now().date_naive());
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .project_overview(&today, &week_start)
}

#[tauri::command]
pub fn week_range() -> Result<(String, String), AppError> {
    let today = Local::now().date_naive();
    let start = week_start_str(&today);
    let end = today + Duration::days(6);
    Ok((start, end.format("%Y-%m-%d").to_string()))
}
