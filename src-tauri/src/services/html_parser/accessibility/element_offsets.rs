use super::*;

/// Finds the source offset of an element in the same order as a browser's
/// `querySelectorAll` result for the small, deterministic selectors used by
/// the accessibility findings. The parser intentionally ignores comments and
/// script/style text so a literal `<img>` or `<button>` in JavaScript cannot
/// shift the reported location.
pub(in crate::services::html_parser) fn element_source_offset(
    source: &str,
    dom_position: usize,
    element: &ElementRef<'_>,
    selector: &str,
) -> Option<usize> {
    if dom_position == 0 {
        return None;
    }

    let expected_name = element.value().name();
    let mut search_from = 0usize;
    let mut position = 0usize;
    while let Some(relative) = source.get(search_from..)?.find('<') {
        let tag_start = search_from + relative;
        let after_opening = tag_start + 1;
        if source[after_opening..].starts_with("!--") {
            search_from = source[after_opening..]
                .find("-->")
                .map_or(source.len(), |offset| after_opening + offset + 3);
            continue;
        }
        let next = source[after_opening..].chars().next()?;
        if matches!(next, '/' | '!' | '?') {
            search_from = after_opening;
            continue;
        }

        let name_end = source[after_opening..]
            .char_indices()
            .find(|(_, character)| {
                character.is_ascii_whitespace() || matches!(character, '>' | '/')
            })
            .map(|(offset, _)| after_opening + offset)
            .unwrap_or(source.len());
        let name = source.get(after_opening..name_end)?.to_ascii_lowercase();

        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_opening..].char_indices() {
            if let Some(active) = quote {
                if character == active {
                    quote = None;
                }
            } else if matches!(character, '\'' | '"') {
                quote = Some(character);
            } else if character == '>' {
                tag_end = Some(after_opening + offset);
                break;
            }
        }
        let Some(tag_end) = tag_end else {
            break;
        };

        if name == "script" || name == "style" {
            let closing_marker = format!("</{name}");
            let source_lower = source[after_opening..].to_ascii_lowercase();
            search_from = source_lower
                .find(&closing_marker)
                .map_or(source.len(), |offset| after_opening + offset);
            continue;
        }

        if name == expected_name
            && source_tag_matches_selector(&source[tag_start..=tag_end], expected_name, selector)
        {
            position += 1;
            if position == dom_position {
                return Some(tag_start);
            }
        }
        search_from = tag_end + 1;
    }
    None
}
