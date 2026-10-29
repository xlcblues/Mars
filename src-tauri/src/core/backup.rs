use std::fs;
use std::path::Path;

use chrono::Local;
use serde::Serialize;

use super::AppError;
use super::db::Database;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub created_at: String,
    pub db_size: i64,
    pub attachment_count: i64,
    pub attachment_bytes: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreInfo {
    pub message: String,
    pub backup_path: String,
    pub restored_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDataInfo {
    pub data_dir: String,
    pub db_path: String,
    pub attachments_path: String,
    pub db_size: i64,
    pub attachment_count: i64,
    pub attachment_bytes: i64,
}

pub fn create_backup(
    db: &Database,
    db_path: &Path,
    attachments_root: &Path,
    target_dir: &Path,
) -> Result<BackupInfo, AppError> {
    if target_dir.as_os_str().is_empty() {
        return Err(AppError("备份目录不能为空".into()));
    }
    if !target_dir.is_dir() {
        return Err(AppError("备份目标不是文件夹".into()));
    }

    db.checkpoint()?;
    let stamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let backup_root = target_dir.join(format!("mars-backup-{stamp}"));
    fs::create_dir_all(&backup_root)?;

    let target_db = backup_root.join("mars.db");
    fs::copy(db_path, &target_db)?;

    let backup_attachments = backup_root.join("attachments");
    if attachments_root.is_dir() {
        copy_dir(attachments_root, &backup_attachments)?;
    } else {
        fs::create_dir_all(&backup_attachments)?;
    }

    let manifest = serde_json::json!({
        "app": "Mars",
        "createdAt": Local::now().to_rfc3339(),
        "dbVersion": db_version(db).unwrap_or(0),
        "tool": "Mars v0.1.0",
    });
    fs::write(
        backup_root.join("backup.json"),
        serde_json::to_string_pretty(&manifest)
            .map_err(|err| AppError(format!("生成备份清单失败：{err}")))?,
    )?;

    let (attachment_count, attachment_bytes) = dir_stats(&backup_attachments);
    Ok(BackupInfo {
        path: backup_root.to_string_lossy().into_owned(),
        created_at: manifest["createdAt"].as_str().unwrap_or("").to_string(),
        db_size: fs::metadata(&target_db)?.len() as i64,
        attachment_count,
        attachment_bytes,
    })
}

pub fn restore_backup(
    db: &mut Database,
    db_path: &Path,
    attachments_root: &Path,
    backup_dir: &Path,
) -> Result<RestoreInfo, AppError> {
    if backup_dir.as_os_str().is_empty() {
        return Err(AppError("备份目录不能为空".into()));
    }
    let backup_db = backup_dir.join("mars.db");
    if !backup_db.is_file() {
        return Err(AppError("备份目录中未找到 mars.db，无法恢复".into()));
    }

    db.checkpoint()?;
    let stamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let parent = db_path.parent().unwrap_or_else(|| Path::new("."));
    let auto_dir = parent.join("restore-backups").join(&stamp);
    fs::create_dir_all(&auto_dir)?;

    if db_path.is_file() {
        fs::copy(db_path, auto_dir.join("mars.db"))?;
    }
    if attachments_root.is_dir() {
        copy_dir(attachments_root, &auto_dir.join("attachments"))?;
    }

    db.restore_from_backup(&backup_db)?;

    if attachments_root.exists() {
        fs::remove_dir_all(attachments_root)?;
    }
    let backup_attachments = backup_dir.join("attachments");
    if backup_attachments.is_dir() {
        copy_dir(&backup_attachments, attachments_root)?;
    } else {
        fs::create_dir_all(attachments_root)?;
    }

    Ok(RestoreInfo {
        message: format!("已从 {} 恢复数据", backup_dir.display()),
        backup_path: auto_dir.to_string_lossy().into_owned(),
        restored_at: Local::now().to_rfc3339(),
    })
}

pub fn local_data_info(db_path: &Path, attachments_root: &Path) -> Result<LocalDataInfo, AppError> {
    let mut db_size = 0_i64;
    if db_path.is_file() {
        db_size += fs::metadata(db_path)?.len() as i64;
        let wal = format!("{}-wal", db_path.display());
        let shm = format!("{}-shm", db_path.display());
        if Path::new(&wal).is_file() {
            db_size += fs::metadata(&wal)?.len() as i64;
        }
        if Path::new(&shm).is_file() {
            db_size += fs::metadata(&shm)?.len() as i64;
        }
    }
    let (attachment_count, attachment_bytes) = dir_stats(attachments_root);
    Ok(LocalDataInfo {
        data_dir: db_path
            .parent()
            .unwrap_or_else(|| Path::new(""))
            .to_string_lossy()
            .into_owned(),
        db_path: db_path.to_string_lossy().into_owned(),
        attachments_path: attachments_root.to_string_lossy().into_owned(),
        db_size,
        attachment_count,
        attachment_bytes,
    })
}

fn db_version(db: &Database) -> Result<i64, AppError> {
    db.checkpoint()?;
    Ok(db.user_version()?)
}

fn copy_dir(source: &Path, target: &Path) -> Result<(), AppError> {
    fs::create_dir_all(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let from = entry.path();
        let to = target.join(entry.file_name());
        if from.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

fn dir_stats(dir: &Path) -> (i64, i64) {
    let mut count = 0_i64;
    let mut bytes = 0_i64;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let (child_count, child_bytes) = dir_stats(&path);
                count += child_count;
                bytes += child_bytes;
            } else if let Ok(meta) = entry.metadata() {
                count += 1;
                bytes += meta.len() as i64;
            }
        }
    }
    (count, bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::db::{Database, WorkEntryInput};
    use std::path::PathBuf;

    fn temp_dir(name: &str) -> PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("mars-backup-{name}-{}-{nanos}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn backup_and_restore_round_trip() {
        let root = temp_dir("round-trip");
        let data = root.join("data");
        fs::create_dir_all(&data).unwrap();
        let db_path = data.join("mars.db");
        let attachments_root = data.join("attachments");
        fs::create_dir_all(&attachments_root).unwrap();

        let db = Database::open(&db_path).unwrap();
        let project = db.create_project("备份项目", Some("#2E8B8B")).unwrap();
        db.save_entry(&WorkEntryInput {
            id: None,
            project_id: Some(project.id),
            work_date: "2026-10-29".into(),
            started_at: Some("09:00".into()),
            ended_at: Some("10:00".into()),
            title: "备份测试记录".into(),
            content: None,
            tags: None,
        })
        .unwrap();
        fs::write(attachments_root.join("note.txt"), "hello mars").unwrap();
        drop(db);

        let target = root.join("backups");
        fs::create_dir_all(&target).unwrap();
        let reopened = Database::open(&db_path).unwrap();
        let info = create_backup(&reopened, &db_path, &attachments_root, &target).unwrap();
        let backup_dir = PathBuf::from(&info.path);
        assert!(backup_dir.join("mars.db").is_file());
        assert!(backup_dir.join("attachments").join("note.txt").is_file());
        drop(reopened);

        let restored_db_path = root.join("restored").join("mars.db");
        let restored_attachments = root.join("restored").join("attachments");
        let mut restored = Database::open(&restored_db_path).unwrap();
        let restore = restore_backup(
            &mut restored,
            &restored_db_path,
            &restored_attachments,
            &backup_dir,
        )
        .unwrap();
        assert!(restore.message.contains("已从"));
        assert!(restored.list_projects(false).unwrap().iter().any(|p| p.name == "备份项目"));
        assert!(restored
            .list_entries(None, None, None, None)
            .unwrap()
            .iter()
            .any(|e| e.title == "备份测试记录"));
        assert!(restored_attachments.join("note.txt").is_file());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn restore_rejects_missing_database() {
        let root = temp_dir("missing-db");
        let db_path = root.join("mars.db");
        let mut db = Database::open(&db_path).unwrap();
        let empty_dir = root.join("empty");
        fs::create_dir_all(&empty_dir).unwrap();
        let err = restore_backup(&mut db, &db_path, &root.join("attachments"), &empty_dir).unwrap_err();
        assert!(err.0.contains("未找到"));
        let _ = fs::remove_dir_all(&root);
    }
}
