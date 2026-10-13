use std::fmt::Display;

/// Build a `map_err` adapter that prefixes a failure with what was attempted.
pub(super) fn failed<E: Display>(context: &'static str) -> impl FnOnce(E) -> String {
    move |error| format!("{context}: {error}")
}

pub(super) fn text<E: Display>(error: E) -> String {
    error.to_string()
}
