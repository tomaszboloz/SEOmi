pub(in crate::services::html_parser) fn form_control_source_offset(
    source: &str,
    dom_position: usize,
) -> Option<usize> {
    if dom_position == 0 {
        return None;
    }
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
        if matches!(name.as_str(), "script" | "style") {
            let closing_marker = format!("</{name}");
            let source_lower = source[after_opening..].to_ascii_lowercase();
            search_from = source_lower
                .find(&closing_marker)
                .map_or(source.len(), |offset| after_opening + offset);
            continue;
        }
        if matches!(name.as_str(), "input" | "select" | "textarea") {
            position += 1;
            if position == dom_position {
                return Some(tag_start);
            }
        }
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
        search_from = tag_end.map_or(source.len(), |offset| offset + 1);
    }
    None
}

pub(in crate::services::html_parser) fn source_line_column(
    source: &str,
    offset: usize,
) -> (Option<usize>, Option<usize>) {
    let offset = offset.min(source.len());
    if !source.is_char_boundary(offset) {
        return (None, None);
    }
    let prefix = &source[..offset];
    let line_start = prefix.rfind('\n').map_or(0, |index| index + 1);
    (
        Some(prefix.bytes().filter(|byte| *byte == b'\n').count() + 1),
        Some(source[line_start..offset].chars().count() + 1),
    )
}
