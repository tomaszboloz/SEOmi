use super::*;

mod simhash;
pub(super) use simhash::*;

pub(super) fn duplicate_heading_groups(
    document: &Html,
    selector: &Selector,
) -> Vec<CrawledDuplicateHeading> {
    let mut indexes = HashMap::<String, usize>::new();
    let mut groups = Vec::<CrawledDuplicateHeading>::new();

    for element in document.select(selector) {
        let Some(level) = element
            .value()
            .name()
            .strip_prefix('h')
            .and_then(|value| value.parse::<usize>().ok())
            .filter(|level| (1..=6).contains(level))
        else {
            continue;
        };
        let text = element.text().collect::<String>();
        let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if text.is_empty() {
            continue;
        }

        let normalized = text.to_lowercase();
        if let Some(index) = indexes.get(&normalized).copied() {
            let group = &mut groups[index];
            group.occurrences += 1;
            if !group.levels.contains(&level) {
                group.levels.push(level);
                group.levels.sort_unstable();
            }
        } else {
            indexes.insert(normalized, groups.len());
            groups.push(CrawledDuplicateHeading {
                text,
                levels: vec![level],
                occurrences: 1,
            });
        }
    }

    groups.retain(|group| group.occurrences > 1);
    groups
}

/// Returns normalized text from the primary content region only. Site chrome
/// (header, navigation, footer, aside/sidebar, hidden consent UI and scripts)
/// is excluded so content metrics and duplicate fingerprints describe the
/// document being audited rather than its application shell.
pub(super) fn semantic_content_text(document: &Html) -> String {
    let body_selector = Selector::parse("body").expect("static body selector is valid");
    let Some(body) = document.select(&body_selector).next() else {
        return String::new();
    };
    let has_primary_root = has_semantic_content_root(document);
    let mut text = Vec::new();
    for node in body.descendants() {
        let Node::Text(value) = node.value() else {
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
        text.push(value.to_string());
    }
    text.join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub(super) fn normalized_content_fingerprint(document: &Html) -> (usize, Option<String>) {
    let text = semantic_content_text(document);
    let word_count = text.split_whitespace().count();
    if text.is_empty() {
        return (0, None);
    }
    let hash = Sha256::digest(text.to_ascii_lowercase().as_bytes());
    (word_count, Some(format!("{:x}", hash)))
}
