pub mod attachments;
pub mod dashboard;
pub mod entries;
pub mod projects;

use std::sync::Mutex;

use crate::core::attachments::Attachments;
use crate::core::db::Database;

pub struct AppState {
    pub db: Mutex<Database>,
    pub attachments: Attachments,
}
