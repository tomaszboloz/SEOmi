use super::*;

const MAX_REDIRECTS_PER_PAGE: usize = 32;

/// Extract only literal JavaScript navigations from inline scripts.
pub(super) fn extract_javascript_redirects(
    document: &Html,
    base_url: &url::Url,
) -> Vec<CrawledClientRedirect> {
    let Ok(script_selector) = Selector::parse("script:not([src])") else {
        return Vec::new();
    };
    let Ok(event_selector) = Selector::parse(
        "*[onclick],*[onload],*[onbeforeunload],*[onunload],*[onpageshow],*[onpopstate]",
    ) else {
        return Vec::new();
    };
    static JS_LOCATION_ASSIGNMENT: OnceLock<Regex> = OnceLock::new();
    let assignment = JS_LOCATION_ASSIGNMENT.get_or_init(|| {
        Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location(?:\.href)?\s*=\s*(['\"])([^'\"]{1,2048})['\"]"#,
        )
        .expect("javascript location assignment pattern is valid")
    });
    static JS_LOCATION_ASSIGNMENT_TEMPLATE: OnceLock<Regex> = OnceLock::new();
    let assignment_template = JS_LOCATION_ASSIGNMENT_TEMPLATE.get_or_init(|| {
        Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location(?:\.href)?\s*=\s*`([^`$]{1,2048})`"#,
        )
        .expect("javascript template location assignment pattern is valid")
    });
    static JS_LOCATION_CALL: OnceLock<Regex> = OnceLock::new();
    let call = JS_LOCATION_CALL.get_or_init(|| {
        Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location\.(?:replace|assign)\s*\(\s*(['\"])([^'\"]{1,2048})['\"]\s*\)"#,
        )
        .expect("javascript location call pattern is valid")
    });
    static JS_LOCATION_CALL_TEMPLATE: OnceLock<Regex> = OnceLock::new();
    let call_template = JS_LOCATION_CALL_TEMPLATE.get_or_init(|| {
        Regex::new(
        r#"(?is)\b(?:(?:window|document|self|top|parent|globalThis)\.)?location\.(?:replace|assign)\s*\(\s*`([^`$]{1,2048})`\s*\)"#,
        )
        .expect("javascript template location call pattern is valid")
    });

    let mut redirects = Vec::new();
    let mut seen = HashSet::new();

    let mut scan = |source: &str, evidence_source: &str| {
        if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
            return;
        }
        for captures in [&assignment, &call] {
            for matched in captures.captures_iter(source) {
                let (Some(full), Some(target)) = (
                    matched.get(0).map(|v| v.as_str().trim()),
                    matched.get(2).map(|v| v.as_str().trim()),
                ) else {
                    continue;
                };
                let target_url = base_url
                    .join(target)
                    .ok()
                    .filter(|u| matches!(u.scheme(), "http" | "https"))
                    .map(|u| u.to_string());
                let dedupe_key = format!("{evidence_source}\u{1f}{full}\u{1f}{target_url:?}");
                if seen.insert(dedupe_key) {
                    redirects.push(CrawledClientRedirect {
                        source: evidence_source.into(),
                        declaration: full.chars().take(2048).collect(),
                        delay_seconds: None,
                        target_url,
                    });
                    if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
                        return;
                    }
                }
            }
        }
        for captures in [&assignment_template, &call_template] {
            for matched in captures.captures_iter(source) {
                let (Some(full), Some(target)) = (
                    matched.get(0).map(|v| v.as_str().trim()),
                    matched.get(1).map(|v| v.as_str().trim()),
                ) else {
                    continue;
                };
                let target_url = base_url
                    .join(target)
                    .ok()
                    .filter(|u| matches!(u.scheme(), "http" | "https"))
                    .map(|u| u.to_string());
                let dedupe_key = format!("{evidence_source}\u{1f}{full}\u{1f}{target_url:?}");
                if seen.insert(dedupe_key) {
                    redirects.push(CrawledClientRedirect {
                        source: evidence_source.into(),
                        declaration: full.chars().take(2048).collect(),
                        delay_seconds: None,
                        target_url,
                    });
                    if redirects.len() >= MAX_REDIRECTS_PER_PAGE {
                        return;
                    }
                }
            }
        }
    };

    for script in document.select(&script_selector) {
        if let Some(script_type) = script.value().attr("type") {
            let norm = script_type.trim().to_ascii_lowercase();
            if !norm.is_empty()
                && !norm.contains("javascript")
                && !norm.contains("ecmascript")
                && norm != "module"
            {
                continue;
            }
        }
        let source = script.text().collect::<String>();
        scan(&source, "javascript");
    }
    for element in document.select(&event_selector) {
        for (name, value) in element.value().attrs() {
            if name.starts_with("on") {
                scan(value, "javascript-inline");
            }
        }
    }
    redirects
}
