//! Every user-visible string of the audit report is a `pdfReport` label key
//! (see `labels.rs`); the constants in these modules hold the keys and the text
//! lives in the locale files. Templates use `{{0}}`, `{{1}}` placeholders.

pub mod checks;
pub mod loc;
pub mod report;

pub use crate::commands::pdf_report::labels::{t, tf};
