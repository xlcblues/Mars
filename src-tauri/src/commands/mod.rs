pub mod ai;
pub mod analytics;
pub mod attachments;
pub mod backup;
pub mod dashboard;
pub mod entries;
pub mod projects;
pub mod reports;

use std::path::PathBuf;
use std::sync::Mutex;

use crate::core::attachments::Attachments;
use crate::core::db::Database;

pub struct AppState {
    pub db: Mutex<Database>,
    pub attachments: Attachments,
    pub db_path: PathBuf,
    pub attachments_root: PathBuf,
}
