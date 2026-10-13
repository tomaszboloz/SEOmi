//! Every user-visible string of the crawl report lives under this module so
//! the report can be localised later. Templates use `{0}`, `{1}` placeholders.

mod labels;
mod labels_cols;
pub mod recs;
pub mod report;

pub use crate::commands::pdf_report::audit_report::strings::t;
