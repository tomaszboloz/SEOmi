use regex::Regex;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

/// A crawl applies the same (at most ten) custom regexes to every page.
/// Compiling each pattern once per page dominated extraction on large crawls,
/// so compiled patterns are reused. The cache is cleared when it grows past a
/// small bound, so stale patterns from earlier crawls cannot accumulate.
const MAX_CACHED_PATTERNS: usize = 64;

pub(super) fn cached_regex(pattern: &str) -> Result<Regex, regex::Error> {
    static CACHE: OnceLock<Mutex<HashMap<String, Regex>>> = OnceLock::new();
    let cache = CACHE.get_or_init(|| Mutex::new(HashMap::new()));
    if let Some(regex) = cache
        .lock()
        .ok()
        .and_then(|cache| cache.get(pattern).cloned())
    {
        return Ok(regex);
    }
    let regex = Regex::new(pattern)?;
    if let Ok(mut cache) = cache.lock() {
        if cache.len() >= MAX_CACHED_PATTERNS {
            cache.clear();
        }
        cache.insert(pattern.to_owned(), regex.clone());
    }
    Ok(regex)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_equivalent_regexes_and_reports_invalid_patterns() {
        let first = cached_regex(r"price:\s*(\d+)").unwrap();
        let second = cached_regex(r"price:\s*(\d+)").unwrap();
        assert_eq!(first.as_str(), second.as_str());
        assert_eq!(&second.captures("price: 42").unwrap()[1], "42");
        assert!(cached_regex("(unclosed").is_err());
    }

    #[test]
    fn stays_correct_after_the_cache_is_cleared() {
        for index in 0..(MAX_CACHED_PATTERNS * 2) {
            let regex = cached_regex(&format!("item-{index}")).unwrap();
            assert!(regex.is_match(&format!("x item-{index} y")));
        }
    }
}
