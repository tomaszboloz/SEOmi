pub(in crate::commands::site_crawler) fn locate_html_attribute(
    source: &str,
    source_lower: &str,
    element: &str,
    attribute: &str,
    expected_value: &str,
    occurrence: usize,
) -> Option<usize> {
    let opening = format!("<{}", element.to_ascii_lowercase());
    let mut search_from = 0usize;
    let mut matched = 0usize;
    while let Some(relative) = source_lower.get(search_from..)?.find(&opening) {
        let tag_start = search_from + relative;
        let after_name = tag_start + opening.len();
        if source_lower[after_name..]
            .chars()
            .next()
            .is_some_and(|c| !(c.is_ascii_whitespace() || c == '/' || c == '>'))
        {
            search_from = after_name;
            continue;
        }
        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_name..].char_indices() {
            if let Some(active) = quote {
                if character == active {
                    quote = None;
                }
            } else if character == '\'' || character == '"' {
                quote = Some(character);
            } else if character == '>' {
                tag_end = Some(after_name + offset);
                break;
            }
        }
        let tag_end = tag_end?;
        let tag = &source[after_name..tag_end];
        let tag_lower = tag.to_ascii_lowercase();
        let mut cursor = 0usize;
        while let Some(relative_attribute) = tag_lower
            .get(cursor..)?
            .find(&attribute.to_ascii_lowercase())
        {
            let name_start = cursor + relative_attribute;
            let name_end = name_start + attribute.len();
            let before_ok = name_start == 0 || tag.as_bytes()[name_start - 1].is_ascii_whitespace();
            let after_ok = tag
                .as_bytes()
                .get(name_end)
                .map_or(true, |b| b.is_ascii_whitespace() || *b == b'=');
            if !before_ok || !after_ok {
                cursor = name_end;
                continue;
            }
            cursor = name_end;
            while tag[cursor..]
                .chars()
                .next()
                .is_some_and(|c| c.is_ascii_whitespace())
            {
                cursor += tag[cursor..].chars().next()?.len_utf8();
            }
            if tag.as_bytes().get(cursor) != Some(&b'=') {
                continue;
            }
            cursor += 1;
            while tag[cursor..]
                .chars()
                .next()
                .is_some_and(|c| c.is_ascii_whitespace())
            {
                cursor += tag[cursor..].chars().next()?.len_utf8();
            }
            let (value_start, value_end) =
                if let Some(q @ ('\'' | '"')) = tag[cursor..].chars().next() {
                    cursor += q.len_utf8();
                    let vstart = cursor;
                    while tag[cursor..].chars().next().is_some_and(|c| c != q) {
                        cursor += tag[cursor..].chars().next()?.len_utf8();
                    }
                    (vstart, cursor)
                } else {
                    let vstart = cursor;
                    while tag[cursor..]
                        .chars()
                        .next()
                        .is_some_and(|c| !c.is_ascii_whitespace() && c != '>')
                    {
                        cursor += tag[cursor..].chars().next()?.len_utf8();
                    }
                    (vstart, cursor)
                };
            if tag[value_start..value_end] == *expected_value {
                if matched == occurrence {
                    return Some(after_name + value_start);
                }
                matched += 1;
            }
            break;
        }
        search_from = tag_end + 1;
    }
    None
}
