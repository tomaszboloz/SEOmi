//! Every user-visible string of the crawl report is a `pdfReport` label key
//! (see `labels.rs`); the constants in these modules hold the keys and the text
//! lives in the locale files. Templates use `{{0}}`, `{{1}}` placeholders.

pub mod focus;
mod labels;
mod labels_cols;
pub mod recs;
pub mod report;
pub mod trust;

pub use crate::commands::pdf_report::labels::{t, tf};
