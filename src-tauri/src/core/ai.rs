use std::io::BufRead;
use std::time::Duration;

use chrono::Local;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::db::{today_str, week_start_str, Database, WorkEntryInput};

const SETTING_KEY: &str = "ai_config";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiAction {
    SaveEntry { entry: WorkEntryInput },
    DeleteEntry { id: i64 },
    CreateProject {
        name: String,
        #[serde(default)]
        color: Option<String>,
    },
    ArchiveProject { id: i64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiChatResponse {
    pub text: String,
    pub actions: Vec<AiAction>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiApplyResult {
    pub applied: usize,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AiStreamEvent {
    Delta { text: String },
    Done { actions: Vec<AiAction> },
}

pub fn get_config(db: &Database) -> Result<Option<AiConfig>, String> {
    let value = db
        .get_setting(SETTING_KEY)
        .map_err(|error| format!("读取 AI 配置失败：{error}"))?;
    value
        .map(|json| {
            serde_json::from_str(&json).map_err(|error| format!("AI 配置解析失败：{error}"))
        })
        .transpose()
}

pub fn save_config(db: &Database, config: &AiConfig) -> Result<AiConfig, String> {
    validate_config(config)?;
    let json = serde_json::to_string(config).map_err(|error| error.to_string())?;
    db.set_setting(SETTING_KEY, &json)
        .map_err(|error| format!("保存 AI 配置失败：{error}"))?;
    Ok(config.clone())
}

fn validate_config(config: &AiConfig) -> Result<(), String> {
    if config.provider.trim().is_empty() {
        return Err("请选择 AI 服务商".to_string());
    }
    if !config.base_url.trim().starts_with("http") {
        return Err("Base URL 无效".to_string());
    }
    if config.model.trim().is_empty() {
        return Err("请填写模型名称".to_string());
    }
    if config.api_key.trim().is_empty() {
        return Err("请填写 API Key".to_string());
    }
    Ok(())
}

pub fn chat_content_stream(
    config: &AiConfig,
    messages: &[ChatMessage],
    on_delta: &mut dyn FnMut(&str) -> Result<(), String>,
) -> Result<String, String> {
    let base = config.base_url.trim().trim_end_matches('/');
    let url = format!("{base}/chat/completions");
    let payload = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "temperature": 0.3,
        "stream": true,
    });
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(30))
        .timeout_read(Duration::from_secs(300))
        .timeout_write(Duration::from_secs(60))
        .build();
    let auth = format!("Bearer {}", config.api_key.trim());
    match agent
        .post(&url)
        .set("Authorization", &auth)
        .set("Content-Type", "application/json")
        .send_json(payload)
    {
        Ok(response) => {
            let status = response.status();
            if !(200..300).contains(&status) {
                let body = response.into_string().unwrap_or_default();
                let hint = if status == 401 {
                    "API Key 无效或已过期"
                } else {
                    "AI 服务错误"
                };
                return Err(format!("{hint}（{status}）：{body}"));
            }
            let reader = response.into_reader();
            let mut buffered = std::io::BufReader::new(reader);
            let mut full = String::new();
            let mut line = String::new();
            loop {
                line.clear();
                let bytes = buffered
                    .read_line(&mut line)
                    .map_err(|error| format!("读取 AI 流失败：{error}"))?;
                if bytes == 0 {
                    break;
                }
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                let data = if let Some(rest) = trimmed.strip_prefix("data:") {
                    rest.trim()
                } else if trimmed.starts_with('{') {
                    trimmed
                } else {
                    continue;
                };
                if data == "[DONE]" {
                    break;
                }
                let value: Value = serde_json::from_str(data)
                    .map_err(|error| format!("解析 AI 流数据失败：{error}"))?;
                if let Some(text) = value
                    .get("choices")
                    .and_then(|choices| choices.get(0))
                    .and_then(|choice| {
                        choice
                            .get("delta")
                            .and_then(|delta| delta.get("content"))
                            .or_else(|| {
                                choice
                                    .get("message")
                                    .and_then(|message| message.get("content"))
                            })
                    })
                    .and_then(|content| content.as_str())
                {
                    full.push_str(text);
                    on_delta(text)?;
                }
            }
            let content = full.trim().to_string();
            if content.is_empty() {
                return Err("AI 返回了空内容".to_string());
            }
            Ok(content)
        }
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            let hint = if status == 401 {
                "API Key 无效或已过期，请检查设置中的 Key"
            } else {
                "AI 服务返回错误"
            };
            Err(format!("{hint}（{status}）：{body}"))
        }
        Err(error) => Err(format!("AI 请求失败：{error}")),
    }
}

pub fn test_connection(config: &AiConfig) -> Result<String, String> {
    let base = config.base_url.trim().trim_end_matches('/');
    let url = format!("{base}/models");
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(Duration::from_secs(20))
        .timeout_read(Duration::from_secs(30))
        .timeout_write(Duration::from_secs(20))
        .build();
    let auth = format!("Bearer {}", config.api_key.trim());
    match agent.get(&url).set("Authorization", &auth).call() {
        Ok(response) => {
            let status = response.status();
            if (200..300).contains(&status) {
                Ok("连接成功，API Key 有效".to_string())
            } else {
                Err(format!("AI 服务错误（{status}）"))
            }
        }
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            let hint = if status == 401 {
                "API Key 无效或已过期，请检查设置中的 Key"
            } else if status == 404 {
                "接口不支持模型列表，可尝试直接对话"
            } else {
                "连接失败，请检查接口地址与 Key"
            };
            Err(format!("{hint}（{status}）：{body}"))
        }
        Err(error) => Err(format!("连接失败：{error}")),
    }
}

pub fn build_context(db: &Database) -> Result<String, String> {
    let today = today_str();
    let week_start = week_start_str(&Local::now().date_naive());
    let mut lines = vec![format!("=== Mars 系统数据（{today}，本周从 {week_start} 开始） ===")];

    match db.dashboard_summary(&today, &week_start) {
        Ok(summary) => lines.push(format!(
            "今日概览：{} 条记录，{} 分钟；本周 {} 条记录；连续记录 {} 天。",
            summary.today_entries, summary.today_minutes, summary.week_entries, summary.streak_days
        )),
        Err(error) => lines.push(format!("今日概览：读取失败（{error}）。")),
    }

    match db.list_projects(false) {
        Ok(projects) if projects.is_empty() => lines.push("项目：暂无进行中的项目。".to_string()),
        Ok(projects) => {
            lines.push("进行中的项目：".to_string());
            for project in projects {
                lines.push(format!(
                    "- #{} {}（颜色 {}）",
                    project.id,
                    project.name,
                    project.color.as_deref().unwrap_or("未设置"),
                ));
            }
        }
        Err(error) => lines.push(format!("项目：读取失败（{error}）。")),
    }

    match db.list_entries(Some(&week_start), Some(&today), None, None) {
        Ok(entries) if entries.is_empty() => lines.push("本周工作记录：暂无。".to_string()),
        Ok(entries) => {
            lines.push("本周工作记录：".to_string());
            for entry in entries {
                let project = entry.project_name.as_deref().unwrap_or("未分配");
                let duration = if entry.duration_minutes > 0 {
                    format!("，{} 分钟", entry.duration_minutes)
                } else {
                    String::new()
                };
                let content = entry
                    .content
                    .as_deref()
                    .filter(|text| !text.trim().is_empty())
                    .unwrap_or("");
                let tags = entry
                    .tags
                    .as_deref()
                    .filter(|text| !text.trim().is_empty())
                    .unwrap_or("无");
                lines.push(format!(
                    "- [{}] #{} {}（{}）{duration}：{}。标签：{}。",
                    entry.work_date, entry.id, entry.title, project, content, tags,
                ));
            }
        }
        Err(error) => lines.push(format!("本周工作记录：读取失败（{error}）。")),
    }

    Ok(lines.join("\n"))
}

const SYSTEM_PROMPT: &str = r##"你是 Mars 个人工作记录应用的 AI 助手。你可以根据下面的系统数据分析用户的工作情况，帮助整理日报、周报，并统计项目投入。当用户明确要求操作数据时，只允许执行四种受控操作：保存工作记录（saveEntry）、删除工作记录（deleteEntry）、创建项目（createProject）、归档项目（archiveProject）。回复正文请使用 Markdown 格式排版，保持清晰易读，没有提供的数据不要编造。

系统数据：
{context}

回复规则：
- 先用 Markdown 输出完整的回复正文，正文中不要出现 JSON。
- 当用户明确要求执行上述操作时，在 Markdown 正文末尾再输出一个 JSON 对象，不要用 markdown 代码块包裹，格式如下：
{"actions":[{"type":"saveEntry","entry":{"projectId":1,"workDate":"YYYY-MM-DD","startedAt":null,"endedAt":null,"title":"标题","content":"内容","tags":"标签"}},{"type":"deleteEntry","id":3},{"type":"createProject","name":"项目名","color":"#C3451F"},{"type":"archiveProject","id":2}]}
- 没有需要执行的操作时，不要输出 JSON。
- 项目 id 必须从系统数据中选取，不能编造；日期使用 YYYY-MM-DD 格式，默认今天。
- 只使用上述四种工具，不要编造工具名。
- JSON 必须放在回复最末尾，正文与 JSON 之间可以换行，JSON 后面不要再输出任何文字。"##;

fn parse_json(text: &str) -> Result<Value, String> {
    let trimmed = text.trim();
    let candidate = if trimmed.starts_with("```") {
        trimmed
            .lines()
            .filter(|line| !line.trim_start().starts_with("```"))
            .collect::<Vec<_>>()
            .join("\n")
            .trim()
            .to_string()
    } else {
        match (trimmed.find('{'), trimmed.rfind('}')) {
            (Some(start), Some(end)) if end > start => trimmed[start..=end].to_string(),
            _ => trimmed.to_string(),
        }
    };
    serde_json::from_str(&candidate).map_err(|error| format!("AI 返回的 JSON 无法解析：{error}"))
}

fn reply_and_actions(raw: &str) -> (String, Vec<AiAction>) {
    if let Ok(value) = parse_json(raw) {
        let actions = value
            .get("actions")
            .and_then(|item| item.as_array())
            .cloned()
            .map(|array| serde_json::from_value(Value::Array(array)).unwrap_or_default())
            .unwrap_or_default();
        if let Some(reply) = value.get("reply").and_then(|item| item.as_str()) {
            return (reply.trim().to_string(), actions);
        }
        let trimmed = raw.trim();
        if let (Some(start), Some(end)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if end > start {
                let text = trimmed[..start].trim().to_string();
                if !text.is_empty() {
                    return (text, actions);
                }
            }
        }
        return (String::new(), actions);
    }
    (raw.trim().to_string(), Vec::new())
}

pub fn chat_with_context_stream(
    config: &AiConfig,
    context: &str,
    prompt: &str,
    history: &[ChatMessage],
    mut on_delta: impl FnMut(&str) -> Result<(), String>,
) -> Result<AiChatResponse, String> {
    let system = SYSTEM_PROMPT.replace("{context}", context);
    let mut messages = vec![ChatMessage {
        role: "system".to_string(),
        content: system,
    }];
    messages.extend_from_slice(history);
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: prompt.trim().to_string(),
    });
    let raw = chat_content_stream(config, &messages, &mut on_delta)?;
    let (text, actions) = reply_and_actions(&raw);
    Ok(AiChatResponse { text, actions })
}

fn validate_entry(entry: &WorkEntryInput) -> Result<(), String> {
    if entry.work_date.trim().is_empty() {
        return Err("记录日期不能为空".to_string());
    }
    if entry.title.trim().is_empty() {
        return Err("记录标题不能为空".to_string());
    }
    Ok(())
}

pub fn apply_actions(
    db: &Database,
    session_id: Option<&str>,
    actions: &[AiAction],
) -> Result<AiApplyResult, String> {
    let mut applied = 0usize;
    for action in actions {
        let (tool_name, args) = match action {
            AiAction::SaveEntry { entry } => {
                validate_entry(entry)?;
                ("saveEntry", serde_json::to_value(entry).unwrap_or_default())
            }
            AiAction::DeleteEntry { id } => ("deleteEntry", serde_json::json!({"id": id})),
            AiAction::CreateProject { name, color } => {
                if name.trim().is_empty() {
                    return Err("项目名称不能为空".to_string());
                }
                (
                    "createProject",
                    serde_json::json!({"name": name, "color": color}),
                )
            }
            AiAction::ArchiveProject { id } => {
                ("archiveProject", serde_json::json!({"id": id}))
            }
        };
        let log_id = db
            .log_ai_tool(session_id, tool_name, Some(&args.to_string()), "running")
            .map_err(|error| format!("记录操作日志失败：{error}"))?;
        let result = match action {
            AiAction::SaveEntry { entry } => db.save_entry(entry).map(|_| ()),
            AiAction::DeleteEntry { id } => db.delete_entry(*id),
            AiAction::CreateProject { name, color } => {
                db.create_project(name, color.as_deref()).map(|_| ())
            }
            AiAction::ArchiveProject { id } => db.archive_project(*id),
        };
        match result {
            Ok(()) => {
                db.update_ai_tool_status(log_id, "done")
                    .map_err(|error| format!("更新操作日志失败：{error}"))?;
                applied += 1;
            }
            Err(error) => {
                let _ = db.update_ai_tool_status(log_id, "error");
                return Err(format!("执行 {tool_name} 失败：{error}"));
            }
        }
    }
    let message = format!("已完成 {applied} 项操作");
    Ok(AiApplyResult { applied, message })
}
