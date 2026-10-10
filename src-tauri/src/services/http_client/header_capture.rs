use reqwest::header::HeaderMap;
use std::collections::HashMap;

/// Captures every response header while retaining the last value for legacy callers.
pub fn capture_headers(
    headers: &HeaderMap,
) -> (HashMap<String, String>, HashMap<String, Vec<String>>) {
    let mut repeated = HashMap::<String, Vec<String>>::new();
    for (name, value) in headers {
        let Ok(value) = value.to_str() else { continue };
        repeated
            .entry(name.as_str().to_ascii_lowercase())
            .or_default()
            .push(value.to_owned());
    }
    let last = repeated
        .iter()
        .filter_map(|(name, values)| values.last().map(|value| (name.clone(), value.clone())))
        .collect();
    (last, repeated)
}
