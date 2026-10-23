use tauri::State;

use crate::core::db::{WorkEntry, WorkEntryInput};

use crate::core::AppError;
use super::AppState;

#[tauri::command]
pub fn list_entries(
    state: State<'_, AppState>,
    start_date: Option<String>,
    end_date: Option<String>,
    project_id: Option<i64>,
    tag: Option<String>,
) -> Result<Vec<WorkEntry>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .list_entries(start_date.as_deref(), end_date.as_deref(), project_id, tag.as_deref())
}

#[tauri::command]
pub fn save_entry(state: State<'_, AppState>, entry: WorkEntryInput) -> Result<WorkEntry, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .save_entry(&entry)
}

#[tauri::command]
pub fn delete_entry(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .delete_entry(id)
}
