use std::path::PathBuf;

use tauri::State;

use crate::core::db::Attachment;

use crate::core::AppError;
use super::AppState;

#[tauri::command]
pub fn add_attachment(
    state: State<'_, AppState>,
    entry_id: i64,
    file_path: String,
    file_name: String,
    mime_type: Option<String>,
) -> Result<Attachment, AppError> {
    let source = PathBuf::from(&file_path);
    let (target, stored_name, size) = state.attachments.save(&source, &file_name)?;
    let result = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .insert_attachment(
            entry_id,
            &stored_name,
            &target.to_string_lossy(),
            mime_type.as_deref(),
            Some(size),
        );
    if result.is_err() {
        let _ = state.attachments.remove(&target.to_string_lossy());
    }
    result
}

#[tauri::command]
pub fn list_attachments(state: State<'_, AppState>, entry_id: i64) -> Result<Vec<Attachment>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .list_attachments(entry_id)
}

#[tauri::command]
pub fn open_attachment(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let attachment = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .get_attachment(id)?
        .ok_or_else(|| AppError("附件不存在".into()))?;
    state.attachments.open(&attachment.file_path)
}

#[tauri::command]
pub fn delete_attachment(state: State<'_, AppState>, id: i64) -> Result<(), AppError> {
    let path = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .delete_attachment(id)?;
    if let Some(path) = path.as_deref() {
        state.attachments.remove(path)?;
    }
    Ok(())
}
