use tauri::State;

use crate::core::db::Project;

use crate::core::AppError;
use super::AppState;

#[tauri::command]
pub fn list_projects(state: State<'_, AppState>, include_archived: bool) -> Result<Vec<Project>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .list_projects(include_archived)
}

#[tauri::command]
pub fn create_project(state: State<'_, AppState>, name: String, color: Option<String>) -> Result<Project, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .create_project(&name, color.as_deref())
}

#[tauri::command]
pub fn update_project(
    state: State<'_, AppState>,
    id: i64,
    name: String,
    color: Option<String>,
) -> Result<Project, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .update_project(id, &name, color.as_deref())
}

#[tauri::command]
pub fn archive_project(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .archive_project(id)
}

#[tauri::command]
pub fn restore_project(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .restore_project(id)
}
