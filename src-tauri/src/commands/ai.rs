use tauri::State;

use crate::core::ai;
use crate::core::db::{AiSession, AiSessionMeta, AiToolLog};
use crate::core::AppError;

use super::AppState;

#[tauri::command]
pub fn get_ai_config(state: State<'_, AppState>) -> Result<Option<ai::AiConfig>, AppError> {
    let db = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?;
    ai::get_config(&db).map_err(AppError)
}

#[tauri::command]
pub fn save_ai_config(
    state: State<'_, AppState>,
    config: ai::AiConfig,
) -> Result<ai::AiConfig, AppError> {
    let db = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?;
    ai::save_config(&db, &config).map_err(AppError)
}

#[tauri::command]
pub fn test_ai_connection(state: State<'_, AppState>) -> Result<String, AppError> {
    let db = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?;
    let config = ai::get_config(&db)
        .map_err(AppError)?
        .ok_or_else(|| AppError("请先保存 AI 配置".into()))?;
    ai::test_connection(&config).map_err(AppError)
}

#[tauri::command]
pub fn list_ai_sessions(state: State<'_, AppState>) -> Result<Vec<AiSessionMeta>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .list_ai_sessions()
}

#[tauri::command]
pub fn get_ai_session(
    state: State<'_, AppState>,
    id: i64,
) -> Result<Option<AiSession>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .get_ai_session(id)
}

#[tauri::command]
pub fn save_ai_session(
    state: State<'_, AppState>,
    id: Option<i64>,
    title: String,
    messages_json: String,
) -> Result<AiSession, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .save_ai_session(id, &title, &messages_json)
}

#[tauri::command]
pub fn delete_ai_session(state: State<'_, AppState>, id: i64) -> Result<bool, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .delete_ai_session(id)
}

#[tauri::command]
pub fn list_ai_tool_logs(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<AiToolLog>, AppError> {
    state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?
        .list_ai_tool_logs(limit.unwrap_or(50))
}

#[tauri::command]
pub fn ai_apply_actions(
    state: State<'_, AppState>,
    session_id: Option<String>,
    actions: Vec<ai::AiAction>,
) -> Result<ai::AiApplyResult, AppError> {
    if actions.is_empty() {
        return Err(AppError("没有可执行的操作".into()));
    }
    let db = state
        .db
        .lock()
        .map_err(|_| AppError("数据库锁获取失败".into()))?;
    ai::apply_actions(&db, session_id.as_deref(), &actions).map_err(AppError)
}

#[tauri::command]
pub fn ai_chat_stream(
    state: State<'_, AppState>,
    prompt: String,
    history: Vec<ai::ChatMessage>,
    channel: tauri::ipc::Channel<ai::AiStreamEvent>,
) -> Result<ai::AiChatResponse, AppError> {
    let trimmed = prompt.trim();
    if trimmed.is_empty() {
        return Err(AppError("请输入消息".into()));
    }
    let (config, context) = {
        let db = state
            .db
            .lock()
            .map_err(|_| AppError("数据库锁获取失败".into()))?;
        let config = ai::get_config(&db)
            .map_err(AppError)?
            .ok_or_else(|| AppError("请先在设置中配置 AI".into()))?;
        let context = ai::build_context(&db).map_err(AppError)?;
        (config, context)
    };
    let response = ai::chat_with_context_stream(&config, &context, trimmed, &history, |delta| {
        channel
            .send(ai::AiStreamEvent::Delta {
                text: delta.to_string(),
            })
            .map_err(|error| error.to_string())
    })
    .map_err(AppError)?;
    channel
        .send(ai::AiStreamEvent::Done {
            actions: response.actions.clone(),
        })
        .map_err(|error| AppError(error.to_string()))?;
    Ok(response)
}
