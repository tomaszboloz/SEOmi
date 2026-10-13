//! Every user-visible string of the audit report lives under this module so
//! the report can be localised later. Templates use `{0}`, `{1}` placeholders.

pub mod checks;
pub mod loc;
pub mod report;

/// Fills `{0}`, `{1}`, ... placeholders of a template.
pub fn t(template: &str, args: &[&str]) -> String {
    args.iter()
        .enumerate()
        .fold(template.to_owned(), |text, (index, value)| {
            text.replace(&format!("{{{index}}}"), value)
        })
}
