use super::*;

/// Return a small, safe source fragment for locating a crawled link in the
/// fetched document. This is evidence, not a copy of the page: values and
/// inline event handlers are redacted and the result is capped by characters.
pub(crate) fn bounded_link_source_excerpt(element: &ElementRef<'_>) -> Option<String> {
    static VALUE_ATTRIBUTE: OnceLock<Regex> = OnceLock::new();
    static EVENT_ATTRIBUTE: OnceLock<Regex> = OnceLock::new();
    let value_attribute = VALUE_ATTRIBUTE.get_or_init(|| {
        Regex::new(r#"(?is)\s+value\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)"#)
            .expect("link value redaction regex is valid")
    });
    let event_attribute = EVENT_ATTRIBUTE.get_or_init(|| {
        Regex::new(r#"(?is)\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)"#)
            .expect("link event redaction regex is valid")
    });
    let compact = element
        .html()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if compact.is_empty() {
        return None;
    }
    let values_redacted = value_attribute.replace_all(&compact, " value=\"[redacted]\"");
    let redacted = event_attribute.replace_all(&values_redacted, " on[redacted]=\"[redacted]\"");
    let excerpt: String = redacted.chars().take(800).collect();
    Some(excerpt)
}

pub(super) fn semantic_content_source(
    document: &Html,
    is_html: bool,
    body_truncated: bool,
    body_read_failed: bool,
) -> String {
    if !is_html || body_truncated || body_read_failed {
        default_semantic_content_source()
    } else if has_semantic_content_root(document) {
        "primary-root".to_string()
    } else {
        "body-fallback".to_string()
    }
}

pub(super) fn extract_semantic_terms(document: &Html) -> Vec<String> {
    const STOP_WORDS: &[&str] = &[
        "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "was", "have",
        "has", "will", "into", "about", "our", "their", "they", "what", "when", "where", "which",
        "who", "how", "can", "not", "but", "all", "one", "more", "use", "now", "get", "our",
        "theirs", "www", "http", "https", "oraz", "jest", "się", "dla", "nie", "jak", "który",
        "która", "które", "przez", "oraz", "aby", "ten", "tej", "jego", "jej", "czy", "lub", "bez",
        "nad", "pod", "przy", "tym", "także", "może", "mogą",
    ];
    let body_selector = Selector::parse("body").expect("static body selector is valid");
    let Some(body) = document.select(&body_selector).next() else {
        return Vec::new();
    };
    let has_primary_root = has_semantic_content_root(document);
    let mut frequencies: HashMap<String, usize> = HashMap::new();
    for node in body.descendants() {
        let Node::Text(text) = node.value() else {
            continue;
        };
        let Some(parent) = node.parent().and_then(ElementRef::wrap) else {
            continue;
        };
        if !semantic_content_contains(&parent, has_primary_root)
            || matches!(
                parent.value().name(),
                "script" | "style" | "noscript" | "svg" | "template"
            )
            || parent
                .ancestors()
                .filter_map(ElementRef::wrap)
                .any(|ancestor| {
                    matches!(
                        ancestor.value().name(),
                        "script" | "style" | "noscript" | "svg" | "template"
                    )
                })
        {
            continue;
        }
        for token in text.split(|character: char| !character.is_alphanumeric()) {
            let normalized = token.trim().to_lowercase();
            if normalized.chars().count() >= 3 && !STOP_WORDS.contains(&normalized.as_str()) {
                *frequencies.entry(normalized).or_default() += 1;
            }
        }
    }
    let mut terms = frequencies.into_iter().collect::<Vec<_>>();
    terms.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    terms
        .into_iter()
        .take(MAX_SEMANTIC_TERMS_PER_PAGE)
        .map(|(term, _)| term)
        .collect()
}

pub(super) fn extract_semantic_excerpts(document: &Html) -> Vec<String> {
    const MAX_CHARS: usize = 240;
    let selector = Selector::parse("p, h1, h2, h3, h4, h5, h6, li, blockquote")
        .expect("static semantic excerpt selector is valid");
    let has_primary_root = has_semantic_content_root(document);
    let mut excerpts = Vec::new();
    let mut seen = HashSet::new();
    for element in document.select(&selector) {
        if !semantic_content_contains(&element, has_primary_root) {
            continue;
        }
        let text = element
            .text()
            .collect::<Vec<_>>()
            .join(" ")
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ");
        let char_count = text.chars().count();
        if !(24..=MAX_CHARS * 4).contains(&char_count) {
            continue;
        }
        let excerpt = text.chars().take(MAX_CHARS).collect::<String>();
        if seen.insert(excerpt.clone()) {
            excerpts.push(excerpt);
        }
        if excerpts.len() >= MAX_SEMANTIC_EXCERPTS_PER_PAGE {
            break;
        }
    }
    excerpts
}
