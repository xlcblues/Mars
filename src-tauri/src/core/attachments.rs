use std::fs;
use std::path::{Path, PathBuf};

use chrono::Local;

use super::AppError;

#[derive(Debug, Clone)]
pub struct Attachments {
    root: PathBuf,
}

impl Attachments {
    pub fn new(root: PathBuf) -> Result<Self, AppError> {
        fs::create_dir_all(&root)?;
        Ok(Self { root })
    }

    pub fn save(&self, source: &Path, original_name: &str) -> Result<(PathBuf, String, i64), AppError> {
        let file_name = safe_file_name(original_name);
        let stamp = Local::now().format("%Y%m%d%H%M%S").to_string();
        let stored_name = format!("{stamp}_{file_name}");
        let target = self.root.join(&stored_name);
        fs::copy(source, &target)?;
        let size = fs::metadata(&target)?.len() as i64;
        Ok((target, file_name, size))
    }

    pub fn open(&self, path: &str) -> Result<(), AppError> {
        tauri_plugin_opener::open_path(path, None::<&str>)?;
        Ok(())
    }

    pub fn remove(&self, path: &str) -> Result<(), AppError> {
        match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(err) => Err(err.into()),
        }
    }
}

fn safe_file_name(name: &str) -> String {
    let name = name
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(name)
        .trim();
    let name: String = name
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' | '\0' | '\r' | '\n' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    let name = name.trim_matches(['.', ' ']);
    if name.is_empty() {
        "attachment".into()
    } else {
        name.to_string()
    }
}
