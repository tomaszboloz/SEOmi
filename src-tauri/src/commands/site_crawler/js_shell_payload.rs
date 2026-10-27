use super::models::SpaPayload;
use scraper::Html;
use serde_json::Value;
use std::collections::{HashSet, VecDeque};

const MAX_NODES: usize = 20_000;
const MAX_TEXT_CHARS: usize = 2_000;
const MAX_LINKS: usize = 100;
const MAX_TITLE_CHARS: usize = 300;
const MIN_PROSE_WORDS: usize = 3;
const TITLE_KEYS: [&str; 4] = ["title", "seoTitle", "metaTitle", "headline"];
const LINK_KEYS: [&str; 5] = ["href", "url", "link", "path", "canonical"];
const ASSET_EXTS: [&str; 12] = [
    ".js", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico", ".woff", ".woff2",
    ".json",
];

/// Parse the embedded JSON payload of a shell script; `None` when it is not
/// plain JSON (e.g. a Nuxt 2 IIFE) or holds no title, prose or links.
pub(super) fn extract(marker: &str, script: &str) -> Option<SpaPayload> {
    let root = parse_payload(marker, script)?;
    let start = match root.get("props") {
        Some(props) if marker == "__NEXT_DATA__" => props,
        _ => &root,
    };
    let mut out = SpaPayload {
        provenance: "payload".into(),
        source: marker.into(),
        ..Default::default()
    };
    walk(start, &mut out);
    let empty = out.title.is_none() && out.text.is_empty() && out.links.is_empty();
    (!empty).then_some(out)
}

fn parse_payload(marker: &str, script: &str) -> Option<Value> {
    let trimmed = script.trim();
    let json = if trimmed.starts_with(['{', '[']) {
        trimmed
    } else {
        let after = &trimmed[trimmed.find(marker)? + marker.len()..];
        after.trim_start().strip_prefix('=')?.trim_start()
    };
    let mut stream = serde_json::Deserializer::from_str(json).into_iter::<Value>();
    stream
        .next()?
        .ok()
        .filter(|value| value.is_object() || value.is_array())
}

fn walk(start: &Value, out: &mut SpaPayload) {
    let mut queue = VecDeque::from([(None, start)]);
    let mut seen = HashSet::new();
    let mut visited = 0;
    while let Some((key, value)) = queue.pop_front() {
        visited += 1;
        if visited > MAX_NODES {
            out.truncated = true;
            return;
        }
        match value {
            Value::Object(map) => queue.extend(map.iter().map(|(k, v)| (Some(k.as_str()), v))),
            Value::Array(items) => queue.extend(items.iter().map(|v| (key, v))),
            Value::String(text) => record_string(key, text, out, &mut seen),
            _ => {}
        }
    }
}

fn record_string(key: Option<&str>, raw: &str, out: &mut SpaPayload, seen: &mut HashSet<String>) {
    let text = raw.trim();
    let key_in =
        |keys: &[&str]| key.is_some_and(|k| keys.iter().any(|c| k.eq_ignore_ascii_case(c)));
    if key_in(&LINK_KEYS) && looks_like_link(text) {
        if out.links.len() >= MAX_LINKS {
            out.truncated = true;
        } else if !out.links.iter().any(|link| link == text) {
            out.links.push(text.to_string());
        }
        return;
    }
    if out.title.is_none()
        && key_in(&TITLE_KEYS)
        && !text.is_empty()
        && text.chars().count() <= MAX_TITLE_CHARS
    {
        out.title = Some(text.to_string());
    }
    let prose = visible_text(text);
    let words = prose.split_whitespace().count();
    if words < MIN_PROSE_WORDS
        || !prose.chars().any(char::is_alphabetic)
        || !seen.insert(prose.clone())
    {
        return;
    }
    out.word_count = out
        .word_count
        .saturating_add(words.min(u32::MAX as usize) as u32);
    let used = out.text.chars().count();
    if used + prose.chars().count() + 1 > MAX_TEXT_CHARS {
        out.truncated = true;
    } else {
        if used > 0 {
            out.text.push('\n');
        }
        out.text.push_str(&prose);
    }
}

/// Strip markup from rich-text strings so only their text is kept.
fn visible_text(text: &str) -> String {
    let plain = if text.contains('<') && text.contains('>') {
        Html::parse_fragment(text)
            .root_element()
            .text()
            .collect::<String>()
    } else {
        text.to_string()
    };
    plain.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn looks_like_link(text: &str) -> bool {
    let internal = text.starts_with('/') && !text.starts_with("//");
    let absolute = text.starts_with("http://") || text.starts_with("https://");
    let file = text
        .split(['?', '#'])
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    (internal || absolute)
        && !text.contains(char::is_whitespace)
        && !ASSET_EXTS.iter().any(|ext| file.ends_with(ext))
}

#[cfg(test)]
#[path = "js_shell_payload_tests.rs"]
mod tests;
