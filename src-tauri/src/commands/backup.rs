use std::path::PathBuf;

use tauri::State;

use super::AppState;
use crate::core::AppError;
use crate::core::backup::{BackupInfo, LocalDataInfo, RestoreInfo};

#[tauri::command]
pub fn local_data_info(state: State<'_, AppState>) -> Result<LocalDataInfo, AppError> {
    crate::core::backup::local_data_info(&state.db_path, &state.attachments_root)
}

#[tauri::command]
pub fn create_backup(
    state: State<'_, AppState>,
    target_dir: String,
) -> Result<BackupInfo, AppError> {
    let target_dir = PathBuf::from(&target_dir);
    let db = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?;
    crate::core::backup::create_backup(&db, &state.db_path, &state.attachments_root, &target_dir)
}

#[tauri::command]
pub fn restore_backup(
    state: State<'_, AppState>,
    backup_dir: String,
) -> Result<RestoreInfo, AppError> {
    let backup_dir = PathBuf::from(&backup_dir);
    let mut db = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?;
    crate::core::backup::restore_backup(
        &mut db,
        &state.db_path,
        &state.attachments_root,
        &backup_dir,
    )
}
