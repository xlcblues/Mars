use std::path::Path;

use chrono::{Datelike, Duration, Local, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use super::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub status: String,
    pub created_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkEntry {
    pub id: i64,
    pub project_id: Option<i64>,
    pub project_name: Option<String>,
    pub project_color: Option<String>,
    pub work_date: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub duration_minutes: i64,
    pub attachment_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: i64,
    pub entry_id: i64,
    pub file_name: String,
    pub file_path: String,
    pub mime_type: Option<String>,
    pub size_bytes: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkEntryInput {
    pub id: Option<i64>,
    pub project_id: Option<i64>,
    pub work_date: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub title: String,
    pub content: Option<String>,
    pub tags: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeekTrendPoint {
    pub date: String,
    pub minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectOverview {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub today_minutes: i64,
    pub week_minutes: i64,
    pub progress: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub today_entries: i64,
    pub today_minutes: i64,
    pub week_entries: i64,
    pub streak_days: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsSummary {
    pub total_minutes: i64,
    pub entry_count: i64,
    pub active_days: i64,
    pub avg_minutes: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayStatPoint {
    pub date: String,
    pub minutes: i64,
    pub entries: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectShare {
    pub id: i64,
    pub name: String,
    pub color: Option<String>,
    pub minutes: i64,
    pub percent: i64,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        let db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), AppError> {
        let version: i64 = self.conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
        if version < 1 {
            self.conn.execute_batch(
                "
                CREATE TABLE projects (
                  id INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  color TEXT,
                  status TEXT NOT NULL DEFAULT 'active',
                  created_at TEXT DEFAULT (datetime('now')),
                  archived_at TEXT
                );
                CREATE TABLE work_entries (
                  id INTEGER PRIMARY KEY,
                  project_id INTEGER REFERENCES projects(id),
                  work_date TEXT NOT NULL,
                  started_at TEXT,
                  ended_at TEXT,
                  title TEXT NOT NULL,
                  content TEXT,
                  tags TEXT,
                  created_at TEXT DEFAULT (datetime('now')),
                  updated_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE attachments (
                  id INTEGER PRIMARY KEY,
                  entry_id INTEGER REFERENCES work_entries(id),
                  file_name TEXT NOT NULL,
                  file_path TEXT NOT NULL,
                  mime_type TEXT,
                  size_bytes INTEGER,
                  created_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE report_templates (
                  id INTEGER PRIMARY KEY,
                  name TEXT NOT NULL,
                  type TEXT NOT NULL,
                  body_json TEXT NOT NULL,
                  variables_json TEXT,
                  is_default INTEGER DEFAULT 0,
                  updated_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE reports (
                  id INTEGER PRIMARY KEY,
                  template_id INTEGER REFERENCES report_templates(id),
                  type TEXT NOT NULL,
                  start_date TEXT NOT NULL,
                  end_date TEXT NOT NULL,
                  content TEXT NOT NULL,
                  exported_at TEXT
                );
                CREATE TABLE ai_tool_logs (
                  id INTEGER PRIMARY KEY,
                  session_id TEXT,
                  tool_name TEXT NOT NULL,
                  args_json TEXT,
                  status TEXT NOT NULL,
                  created_at TEXT DEFAULT (datetime('now'))
                );
                CREATE TABLE settings (
                  key TEXT PRIMARY KEY,
                  value TEXT
                );
                CREATE INDEX idx_entries_date ON work_entries(work_date);
                CREATE INDEX idx_entries_project ON work_entries(project_id);
                CREATE INDEX idx_attachments_entry ON attachments(entry_id);
                INSERT INTO projects (name, color, status) VALUES ('默认项目', '#C3451F', 'active');
                PRAGMA user_version = 1;
                ",
            )?;
        }
        Ok(())
    }

    fn row_to_project(row: &rusqlite::Row<'_>) -> rusqlite::Result<Project> {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            status: row.get(3)?,
            created_at: row.get(4)?,
            archived_at: row.get(5)?,
        })
    }

    const ENTRY_SELECT: &'static str = "
        SELECT e.id, e.project_id, p.name, p.color, e.work_date,
               e.started_at, e.ended_at, e.title, e.content, e.tags,
               e.created_at, e.updated_at,
               CASE WHEN e.started_at IS NOT NULL AND e.ended_at IS NOT NULL
                 THEN (strftime('%s', e.ended_at) - strftime('%s', e.started_at)) / 60
                 ELSE 0 END,
               (SELECT COUNT(*) FROM attachments a WHERE a.entry_id = e.id)
        FROM work_entries e
        LEFT JOIN projects p ON p.id = e.project_id
    ";

    fn row_to_entry(row: &rusqlite::Row<'_>) -> rusqlite::Result<WorkEntry> {
        Ok(WorkEntry {
            id: row.get(0)?,
            project_id: row.get(1)?,
            project_name: row.get(2)?,
            project_color: row.get(3)?,
            work_date: row.get(4)?,
            started_at: row.get(5)?,
            ended_at: row.get(6)?,
            title: row.get(7)?,
            content: row.get(8)?,
            tags: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
            duration_minutes: row.get(12)?,
            attachment_count: row.get(13)?,
        })
    }

    pub fn list_projects(&self, include_archived: bool) -> Result<Vec<Project>, AppError> {
        let sql = if include_archived {
            "SELECT id, name, color, status, created_at, archived_at FROM projects ORDER BY status = 'active' DESC, id ASC"
        } else {
            "SELECT id, name, color, status, created_at, archived_at FROM projects WHERE status = 'active' ORDER BY id ASC"
        };
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map([], Self::row_to_project)?;
        let mut projects = Vec::new();
        for row in rows {
            projects.push(row?);
        }
        Ok(projects)
    }

    pub fn create_project(&self, name: &str, color: Option<&str>) -> Result<Project, AppError> {
        self.conn.execute(
            "INSERT INTO projects (name, color, status) VALUES (?1, ?2, 'active')",
            params![name, color],
        )?;
        let id = self.conn.last_insert_rowid();
        self.get_project(id)?
            .ok_or_else(|| AppError("创建项目后读取失败".into()))
    }

    pub fn update_project(&self, id: i64, name: &str, color: Option<&str>) -> Result<Project, AppError> {
        let changed = self.conn.execute(
            "UPDATE projects SET name = ?1, color = ?2 WHERE id = ?3 AND status = 'active'",
            params![name, color, id],
        )?;
        if changed == 0 {
            return Err(AppError("项目不存在或已归档".into()));
        }
        self.get_project(id)?
            .ok_or_else(|| AppError("更新后读取项目失败".into()))
    }

    pub fn archive_project(&self, id: i64) -> Result<(), AppError> {
        let changed = self.conn.execute(
            "UPDATE projects SET status = 'archived', archived_at = datetime('now') WHERE id = ?1 AND status = 'active'",
            params![id],
        )?;
        if changed == 0 {
            return Err(AppError("项目不存在或已归档".into()));
        }
        Ok(())
    }

    pub fn restore_project(&self, id: i64) -> Result<(), AppError> {
        let changed = self.conn.execute(
            "UPDATE projects SET status = 'active', archived_at = NULL WHERE id = ?1 AND status = 'archived'",
            params![id],
        )?;
        if changed == 0 {
            return Err(AppError("项目不存在或未归档".into()));
        }
        Ok(())
    }

    pub fn get_project(&self, id: i64) -> Result<Option<Project>, AppError> {
        self.conn
            .query_row(
                "SELECT id, name, color, status, created_at, archived_at FROM projects WHERE id = ?1",
                params![id],
                Self::row_to_project,
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn list_entries(
        &self,
        start_date: Option<&str>,
        end_date: Option<&str>,
        project_id: Option<i64>,
        tag: Option<&str>,
    ) -> Result<Vec<WorkEntry>, AppError> {
        let mut conditions = Vec::new();
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        if let Some(start) = start_date {
            conditions.push("e.work_date >= ?");
            values.push(Box::new(start.to_string()));
        }
        if let Some(end) = end_date {
            conditions.push("e.work_date <= ?");
            values.push(Box::new(end.to_string()));
        }
        if let Some(project) = project_id {
            conditions.push("e.project_id = ?");
            values.push(Box::new(project));
        }
        if let Some(tag) = tag {
            conditions.push("e.tags LIKE ?");
            values.push(Box::new(format!("%{}%", tag)));
        }
        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conditions.join(" AND "))
        };
        let sql = format!(
            "{} {} ORDER BY e.work_date DESC, e.started_at DESC, e.id DESC",
            Self::ENTRY_SELECT,
            where_clause
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(values.iter()), Self::row_to_entry)?;
        let mut entries = Vec::new();
        for row in rows {
            entries.push(row?);
        }
        Ok(entries)
    }

    pub fn save_entry(&self, entry: &WorkEntryInput) -> Result<WorkEntry, AppError> {
        if let Some(id) = entry.id {
            let changed = self.conn.execute(
                "UPDATE work_entries SET
                   project_id = ?1, work_date = ?2, started_at = ?3, ended_at = ?4,
                   title = ?5, content = ?6, tags = ?7, updated_at = datetime('now')
                 WHERE id = ?8",
                params![
                    entry.project_id,
                    entry.work_date,
                    entry.started_at,
                    entry.ended_at,
                    entry.title,
                    entry.content,
                    entry.tags,
                    id
                ],
            )?;
            if changed == 0 {
                return Err(AppError("记录不存在".into()));
            }
        } else {
            self.conn.execute(
                "INSERT INTO work_entries
                   (project_id, work_date, started_at, ended_at, title, content, tags, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))",
                params![
                    entry.project_id,
                    entry.work_date,
                    entry.started_at,
                    entry.ended_at,
                    entry.title,
                    entry.content,
                    entry.tags
                ],
            )?;
        }
        let id = entry.id.unwrap_or_else(|| self.conn.last_insert_rowid());
        self.get_entry(id)?
            .ok_or_else(|| AppError("保存记录后读取失败".into()))
    }

    pub fn get_entry(&self, id: i64) -> Result<Option<WorkEntry>, AppError> {
        let sql = format!("{} WHERE e.id = ?1", Self::ENTRY_SELECT);
        self.conn
            .query_row(&sql, params![id], Self::row_to_entry)
            .optional()
            .map_err(Into::into)
    }

    pub fn delete_entry(&self, id: i64) -> Result<(), AppError> {
        let changed = self.conn.execute("DELETE FROM work_entries WHERE id = ?1", params![id])?;
        if changed == 0 {
            return Err(AppError("记录不存在".into()));
        }
        Ok(())
    }

    pub fn list_attachments(&self, entry_id: i64) -> Result<Vec<Attachment>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, entry_id, file_name, file_path, mime_type, size_bytes, created_at
             FROM attachments WHERE entry_id = ?1 ORDER BY id ASC",
        )?;
        let rows = stmt.query_map(params![entry_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                entry_id: row.get(1)?,
                file_name: row.get(2)?,
                file_path: row.get(3)?,
                mime_type: row.get(4)?,
                size_bytes: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        let mut attachments = Vec::new();
        for row in rows {
            attachments.push(row?);
        }
        Ok(attachments)
    }

    pub fn insert_attachment(
        &self,
        entry_id: i64,
        file_name: &str,
        file_path: &str,
        mime_type: Option<&str>,
        size_bytes: Option<i64>,
    ) -> Result<Attachment, AppError> {
        self.conn.execute(
            "INSERT INTO attachments (entry_id, file_name, file_path, mime_type, size_bytes, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))",
            params![entry_id, file_name, file_path, mime_type, size_bytes],
        )?;
        let id = self.conn.last_insert_rowid();
        self.get_attachment(id)?
            .ok_or_else(|| AppError("保存附件元数据失败".into()))
    }

    pub fn get_attachment(&self, id: i64) -> Result<Option<Attachment>, AppError> {
        self.conn
            .query_row(
                "SELECT id, entry_id, file_name, file_path, mime_type, size_bytes, created_at
                 FROM attachments WHERE id = ?1",
                params![id],
                |row| {
                    Ok(Attachment {
                        id: row.get(0)?,
                        entry_id: row.get(1)?,
                        file_name: row.get(2)?,
                        file_path: row.get(3)?,
                        mime_type: row.get(4)?,
                        size_bytes: row.get(5)?,
                        created_at: row.get(6)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn delete_attachment(&self, id: i64) -> Result<Option<String>, AppError> {
        let attachment = self.get_attachment(id)?;
        let changed = self.conn.execute("DELETE FROM attachments WHERE id = ?1", params![id])?;
        if changed == 0 {
            return Err(AppError("附件不存在".into()));
        }
        Ok(attachment.map(|item| item.file_path))
    }

    pub fn dashboard_summary(&self, today: &str, week_start: &str) -> Result<DashboardSummary, AppError> {
        let today_entries: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM work_entries WHERE work_date = ?1",
            params![today],
            |row| row.get(0),
        )?;
        let today_minutes: i64 = self.conn.query_row(
            "SELECT COALESCE(SUM(
               CASE WHEN started_at IS NOT NULL AND ended_at IS NOT NULL
                 THEN (strftime('%s', ended_at) - strftime('%s', started_at)) / 60
                 ELSE 0 END), 0)
             FROM work_entries WHERE work_date = ?1",
            params![today],
            |row| row.get(0),
        )?;
        let week_entries: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM work_entries WHERE work_date >= ?1 AND work_date <= ?2",
            params![week_start, today],
            |row| row.get(0),
        )?;

        let mut streak_days: i64 = 0;
        let mut cursor = Local::now().date_naive().pred_opt();
        while let Some(date) = cursor {
            let count: i64 = self.conn.query_row(
                "SELECT COUNT(*) FROM work_entries WHERE work_date = ?1",
                params![date.format("%Y-%m-%d").to_string()],
                |row| row.get(0),
            )?;
            if count > 0 {
                streak_days += 1;
            } else {
                break;
            }
            cursor = date.pred_opt();
        }

        Ok(DashboardSummary {
            today_entries,
            today_minutes,
            week_entries,
            streak_days,
        })
    }

    pub fn week_trend(&self, start: &NaiveDate) -> Result<Vec<WeekTrendPoint>, AppError> {
        let mut points = Vec::new();
        for offset in 0..7 {
            let day = *start + Duration::days(offset);
            let minutes: i64 = self.conn.query_row(
                "SELECT COALESCE(SUM(
                   CASE WHEN started_at IS NOT NULL AND ended_at IS NOT NULL
                     THEN (strftime('%s', ended_at) - strftime('%s', started_at)) / 60
                     ELSE 0 END), 0)
                 FROM work_entries WHERE work_date = ?1",
                params![day.format("%Y-%m-%d").to_string()],
                |row| row.get(0),
            )?;
            points.push(WeekTrendPoint {
                date: day.format("%Y-%m-%d").to_string(),
                minutes,
            });
        }
        Ok(points)
    }

    pub fn project_overview(&self, today: &str, week_start: &str) -> Result<Vec<ProjectOverview>, AppError> {
        let mut stmt = self.conn.prepare(
            "SELECT p.id, p.name, p.color,
               COALESCE(SUM(CASE WHEN e.work_date = ?1 AND e.started_at IS NOT NULL AND e.ended_at IS NOT NULL
                 THEN (strftime('%s', e.ended_at) - strftime('%s', e.started_at)) / 60 ELSE 0 END), 0),
               COALESCE(SUM(CASE WHEN e.work_date >= ?2 AND e.work_date <= ?1 AND e.started_at IS NOT NULL AND e.ended_at IS NOT NULL
                 THEN (strftime('%s', e.ended_at) - strftime('%s', e.started_at)) / 60 ELSE 0 END), 0)
             FROM projects p
             LEFT JOIN work_entries e ON e.project_id = p.id
             WHERE p.status = 'active'
             GROUP BY p.id, p.name, p.color
             ORDER BY SUM(CASE WHEN e.work_date >= ?2 AND e.work_date <= ?1 AND e.started_at IS NOT NULL AND e.ended_at IS NOT NULL
               THEN (strftime('%s', e.ended_at) - strftime('%s', e.started_at)) / 60 ELSE 0 END) DESC
        ",
        )?;
        let rows = stmt.query_map(params![today, week_start], |row| {
            Ok(ProjectOverview {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                today_minutes: row.get(3)?,
                week_minutes: row.get(4)?,
                progress: (row.get::<_, i64>(4)? * 100) / WEEK_TARGET_MINUTES,
            })
        })?;
        let mut projects = Vec::new();
        for row in rows {
            projects.push(row?);
        }
        Ok(projects)
    }

    fn analytics_conditions(
        start_date: &str,
        end_date: &str,
        project_id: Option<i64>,
        tag: Option<&str>,
    ) -> (String, Vec<Box<dyn rusqlite::types::ToSql>>) {
        let mut conditions = vec!["e.work_date >= ?".to_string(), "e.work_date <= ?".to_string()];
        let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
            Box::new(start_date.to_string()),
            Box::new(end_date.to_string()),
        ];
        if let Some(project) = project_id {
            conditions.push("e.project_id = ?".to_string());
            values.push(Box::new(project));
        }
        if let Some(tag) = tag {
            conditions.push("e.tags LIKE ?".to_string());
            values.push(Box::new(format!("%{}%", tag)));
        }
        (format!(" WHERE {}", conditions.join(" AND ")), values)
    }

    pub fn analytics_summary(
        &self,
        start_date: &str,
        end_date: &str,
        project_id: Option<i64>,
        tag: Option<&str>,
    ) -> Result<AnalyticsSummary, AppError> {
        let (where_clause, values) = Self::analytics_conditions(start_date, end_date, project_id, tag);
        let sql = format!(
            "SELECT COALESCE(SUM(CASE WHEN e.started_at IS NOT NULL AND e.ended_at IS NOT NULL
               THEN (strftime('%s', e.ended_at) - strftime('%s', e.started_at)) / 60 ELSE 0 END), 0),
               COUNT(*), COUNT(DISTINCT e.work_date)
             FROM work_entries e{where_clause}"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let row = stmt.query_row(rusqlite::params_from_iter(values.iter()), |row| {
            Ok(AnalyticsSummary {
                total_minutes: row.get(0)?,
                entry_count: row.get(1)?,
                active_days: row.get(2)?,
                avg_minutes: 0.0,
            })
        })?;
        let mut summary = row;
        summary.avg_minutes = if summary.active_days > 0 {
            summary.total_minutes as f64 / summary.active_days as f64
        } else {
            0.0
        };
        Ok(summary)
    }

    pub fn daily_trend(
        &self,
        start_date: &str,
        end_date: &str,
        project_id: Option<i64>,
        tag: Option<&str>,
    ) -> Result<Vec<DayStatPoint>, AppError> {
        let (where_clause, values) = Self::analytics_conditions(start_date, end_date, project_id, tag);
        let sql = format!(
            "SELECT e.work_date,
               COALESCE(SUM(CASE WHEN e.started_at IS NOT NULL AND e.ended_at IS NOT NULL
                 THEN (strftime('%s', e.ended_at) - strftime('%s', e.started_at)) / 60 ELSE 0 END), 0),
               COUNT(*)
             FROM work_entries e{where_clause}
             GROUP BY e.work_date
             ORDER BY e.work_date"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(values.iter()), |row| {
            Ok(DayStatPoint {
                date: row.get(0)?,
                minutes: row.get(1)?,
                entries: row.get(2)?,
            })
        })?;
        let mut by_date = std::collections::HashMap::new();
        for row in rows {
            let point = row?;
            by_date.insert(point.date.clone(), point);
        }
        let start = NaiveDate::parse_from_str(start_date, "%Y-%m-%d").map_err(|err| AppError(err.to_string()))?;
        let end = NaiveDate::parse_from_str(end_date, "%Y-%m-%d").map_err(|err| AppError(err.to_string()))?;
        let mut points = Vec::new();
        let mut day = start;
        while day <= end {
            let key = day.format("%Y-%m-%d").to_string();
            points.push(by_date.remove(&key).unwrap_or(DayStatPoint {
                date: key,
                minutes: 0,
                entries: 0,
            }));
            day += Duration::days(1);
        }
        Ok(points)
    }

    pub fn project_share(
        &self,
        start_date: &str,
        end_date: &str,
        project_id: Option<i64>,
        tag: Option<&str>,
    ) -> Result<Vec<ProjectShare>, AppError> {
        let (where_clause, values) = Self::analytics_conditions(start_date, end_date, project_id, tag);
        let sql = format!(
            "SELECT p.id, p.name, p.color,
               COALESCE(SUM(CASE WHEN e.started_at IS NOT NULL AND e.ended_at IS NOT NULL
                 THEN (strftime('%s', e.ended_at) - strftime('%s', e.started_at)) / 60 ELSE 0 END), 0)
             FROM projects p
             JOIN work_entries e ON e.project_id = p.id{where_clause}
             GROUP BY p.id, p.name, p.color
             ORDER BY 3 DESC"
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(values.iter()), |row| {
            Ok(ProjectShare {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                minutes: row.get(3)?,
                percent: 0,
            })
        })?;
        let mut shares = Vec::new();
        for row in rows {
            shares.push(row?);
        }
        let total: i64 = shares.iter().map(|share| share.minutes).sum();
        if total > 0 {
            for share in &mut shares {
                share.percent = (share.minutes * 100) / total;
            }
        }
        Ok(shares)
    }
}

const WEEK_TARGET_MINUTES: i64 = 20 * 60;

pub fn analytics_csv(
    summary: &AnalyticsSummary,
    daily: &[DayStatPoint],
    projects: &[ProjectShare],
) -> String {
    let mut csv = String::from("Mars 数据分析\n");
    csv.push_str(&format!(
        "总专注分钟,记录条数,活跃天数,日均分钟\n{},{},{},{:.1}\n\n",
        summary.total_minutes, summary.entry_count, summary.active_days, summary.avg_minutes
    ));
    csv.push_str("日期,专注分钟,记录条数\n");
    for point in daily {
        csv.push_str(&format!("{},{},{}\n", point.date, point.minutes, point.entries));
    }
    csv.push('\n');
    csv.push_str("项目,专注分钟,占比\n");
    for project in projects {
        csv.push_str(&format!("{},{},{}%\n", project.name, project.minutes, project.percent));
    }
    csv
}

pub fn analytics_json(
    summary: &AnalyticsSummary,
    daily: &[DayStatPoint],
    projects: &[ProjectShare],
) -> String {
    serde_json::to_string_pretty(&serde_json::json!({
        "summary": summary,
        "daily": daily,
        "projects": projects,
    }))
    .unwrap_or_else(|_| "{}".into())
}

pub fn today_str() -> String {
    Local::now().date_naive().format("%Y-%m-%d").to_string()
}

pub fn week_start_str(today: &NaiveDate) -> String {
    let weekday = today.weekday().num_days_from_monday() as i64;
    (*today - chrono::Duration::days(weekday))
        .format("%Y-%m-%d")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> Database {
        Database::open_in_memory().expect("memory db")
    }

    #[test]
    fn project_crud_and_archive() {
        let db = db();
        assert_eq!(db.list_projects(false).unwrap().len(), 1);

        let project = db.create_project("Mars 桌面端", Some("#C3451F")).unwrap();
        assert_eq!(project.name, "Mars 桌面端");

        let updated = db
            .update_project(project.id, "Mars 客户端", Some("#E14B2B"))
            .unwrap();
        assert_eq!(updated.name, "Mars 客户端");
        assert_eq!(updated.color.as_deref(), Some("#E14B2B"));

        db.archive_project(project.id).unwrap();
        let archived = db.get_project(project.id).unwrap().unwrap();
        assert_eq!(archived.status, "archived");
        assert!(archived.archived_at.is_some());
        assert!(db
            .list_projects(false)
            .unwrap()
            .iter()
            .all(|p| p.status == "active"));

        db.restore_project(project.id).unwrap();
        assert_eq!(db.get_project(project.id).unwrap().unwrap().status, "active");
    }

    #[test]
    fn entry_save_query_delete_and_duration() {
        let db = db();
        let project = db.create_project("数据看板", Some("#2E8B8B")).unwrap();

        let entry = db
            .save_entry(&WorkEntryInput {
                id: None,
                project_id: Some(project.id),
                work_date: "2026-10-22".into(),
                started_at: Some("09:00".into()),
                ended_at: Some("10:30".into()),
                title: "梳理指标口径".into(),
                content: Some("对齐日活与留存口径".into()),
                tags: Some("指标,分析".into()),
            })
            .unwrap();
        assert_eq!(entry.duration_minutes, 90);
        assert_eq!(entry.project_name.as_deref(), Some("数据看板"));

        let filtered = db
            .list_entries(Some("2026-10-22"), Some("2026-10-22"), Some(project.id), None)
            .unwrap();
        assert_eq!(filtered.len(), 1);

        let tagged = db.list_entries(None, None, None, Some("指标")).unwrap();
        assert!(tagged.iter().any(|e| e.id == entry.id));
        let untagged = db.list_entries(None, None, None, Some("不存在")).unwrap();
        assert!(untagged.is_empty());

        db.save_entry(&WorkEntryInput {
            id: Some(entry.id),
            project_id: Some(project.id),
            work_date: "2026-10-22".into(),
            started_at: Some("14:00".into()),
            ended_at: Some("15:00".into()),
            title: "梳理指标口径（更新）".into(),
            content: None,
            tags: Some("分析".into()),
        })
        .unwrap();
        let updated = db.get_entry(entry.id).unwrap().unwrap();
        assert_eq!(updated.title, "梳理指标口径（更新）");
        assert_eq!(updated.duration_minutes, 60);

        let attachment = db
            .insert_attachment(entry.id, "notes.md", "/tmp/notes.md", Some("text/markdown"), Some(1024))
            .unwrap();
        assert_eq!(db.list_attachments(entry.id).unwrap().len(), 1);
        let removed_path = db.delete_attachment(attachment.id).unwrap();
        assert_eq!(removed_path.as_deref(), Some("/tmp/notes.md"));
        assert!(db.list_attachments(entry.id).unwrap().is_empty());

        db.delete_entry(entry.id).unwrap();
        assert!(db.get_entry(entry.id).unwrap().is_none());
    }

    #[test]
    fn dashboard_and_trend() {
        let db = db();
        let project = db.create_project("Mars 桌面端", Some("#C3451F")).unwrap();
        let today = today_str();
        let week_start = week_start_str(&Local::now().date_naive());

        db.save_entry(&WorkEntryInput {
            id: None,
            project_id: Some(project.id),
            work_date: today.clone(),
            started_at: Some("09:00".into()),
            ended_at: Some("10:00".into()),
            title: "今日记录".into(),
            content: None,
            tags: None,
        })
        .unwrap();

        let summary = db.dashboard_summary(&today, &week_start).unwrap();
        assert_eq!(summary.today_entries, 1);
        assert_eq!(summary.today_minutes, 60);
        assert_eq!(summary.week_entries, 1);

        let start = NaiveDate::parse_from_str(&week_start, "%Y-%m-%d").unwrap();
        let trend = db.week_trend(&start).unwrap();
        assert_eq!(trend.len(), 7);
        let today_point = trend.iter().find(|p| p.date == today).unwrap();
        assert_eq!(today_point.minutes, 60);

        let overview = db.project_overview(&today, &week_start).unwrap();
        let target = overview.iter().find(|p| p.id == project.id).unwrap();
        assert_eq!(target.week_minutes, 60);
        assert!(target.progress > 0);
    }

    #[test]
    fn analytics_filters_and_export() {
        let db = db();
        let project_a = db.create_project("数据看板", Some("#2E8B8B")).unwrap();
        let project_b = db.create_project("Mars 客户端", Some("#E14B2B")).unwrap();
        let today = today_str();
        let yesterday = (Local::now().date_naive() - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();

        db.save_entry(&WorkEntryInput {
            id: None,
            project_id: Some(project_a.id),
            work_date: yesterday.clone(),
            started_at: Some("09:00".into()),
            ended_at: Some("10:00".into()),
            title: "梳理指标口径".into(),
            content: None,
            tags: Some("指标,分析".into()),
        })
        .unwrap();
        db.save_entry(&WorkEntryInput {
            id: None,
            project_id: Some(project_a.id),
            work_date: today.clone(),
            started_at: Some("10:00".into()),
            ended_at: Some("11:00".into()),
            title: "输出看板初稿".into(),
            content: None,
            tags: Some("分析".into()),
        })
        .unwrap();
        db.save_entry(&WorkEntryInput {
            id: None,
            project_id: Some(project_b.id),
            work_date: today.clone(),
            started_at: Some("14:00".into()),
            ended_at: Some("15:00".into()),
            title: "Mars 客户端联调".into(),
            content: None,
            tags: Some("开发".into()),
        })
        .unwrap();

        let summary = db.analytics_summary(&yesterday, &today, None, None).unwrap();
        assert_eq!(summary.total_minutes, 180);
        assert_eq!(summary.entry_count, 3);
        assert_eq!(summary.active_days, 2);
        assert_eq!(summary.avg_minutes, 90.0);

        let tag_summary = db
            .analytics_summary(&yesterday, &today, None, Some("指标"))
            .unwrap();
        assert_eq!(tag_summary.total_minutes, 60);
        assert_eq!(tag_summary.entry_count, 1);

        let project_summary = db
            .analytics_summary(&yesterday, &today, Some(project_b.id), None)
            .unwrap();
        assert_eq!(project_summary.total_minutes, 60);

        let daily = db.daily_trend(&yesterday, &today, None, None).unwrap();
        assert_eq!(daily.len(), 2);
        assert_eq!(daily[0].minutes, 60);
        assert_eq!(daily[0].entries, 1);
        assert_eq!(daily[1].minutes, 120);

        let share = db.project_share(&yesterday, &today, None, None).unwrap();
        let a = share.iter().find(|p| p.id == project_a.id).unwrap();
        let b = share.iter().find(|p| p.id == project_b.id).unwrap();
        assert_eq!(a.minutes, 120);
        assert_eq!(a.percent, 66);
        assert_eq!(b.minutes, 60);
        assert_eq!(b.percent, 33);

        let csv = analytics_csv(&summary, &daily, &share);
        assert!(csv.contains("日期,专注分钟,记录条数"));
        assert!(csv.contains("数据看板,120,66%"));
        let json = analytics_json(&summary, &daily, &share);
        assert!(json.contains("\"daily\""));
        assert!(json.contains("\"projects\""));
    }
}
