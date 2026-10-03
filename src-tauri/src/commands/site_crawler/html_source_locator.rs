use super::*;

pub(super) fn is_valid_percent_encoding(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len()
                || !bytes[index + 1].is_ascii_hexdigit()
                || !bytes[index + 2].is_ascii_hexdigit()
            {
                return false;
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    true
}

pub(super) fn push_html_validation_finding(
    findings: &mut Vec<CrawledHtmlValidationFinding>,
    truncated: &mut bool,
    finding: CrawledHtmlValidationFinding,
) {
    if findings.len() < MAX_HTML_VALIDATION_FINDINGS_PER_PAGE {
        findings.push(finding);
    } else {
        *truncated = true;
    }
}

pub(super) fn locate_html_attribute(
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
        if source_lower[after_name..].chars().next().is_some_and(|c| {
            !(c.is_ascii_whitespace() || c == '/' || c == '>')
        }) {
            search_from = after_name;
            continue;
        }
        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_name..].char_indices() {
            if let Some(active) = quote {
                if character == active { quote = None; }
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
        while let Some(relative_attribute) = tag_lower.get(cursor..)?.find(&attribute.to_ascii_lowercase()) {
            let name_start = cursor + relative_attribute;
            let name_end = name_start + attribute.len();
            let before_ok = name_start == 0 || tag.as_bytes()[name_start - 1].is_ascii_whitespace();
            let after_ok = tag.as_bytes().get(name_end).map_or(true, |b| b.is_ascii_whitespace() || *b == b'=');
            if !before_ok || !after_ok {
                cursor = name_end;
                continue;
            }
            cursor = name_end;
            while tag[cursor..].chars().next().is_some_and(|c| c.is_ascii_whitespace()) {
                cursor += tag[cursor..].chars().next()?.len_utf8();
            }
            if tag.as_bytes().get(cursor) != Some(&b'=') { continue; }
            cursor += 1;
            while tag[cursor..].chars().next().is_some_and(|c| c.is_ascii_whitespace()) {
                cursor += tag[cursor..].chars().next()?.len_utf8();
            }
            let (value_start, value_end) = if let Some(q @ ('\'' | '"')) = tag[cursor..].chars().next() {
                cursor += q.len_utf8();
                let vstart = cursor;
                while tag[cursor..].chars().next().is_some_and(|c| c != q) {
                    cursor += tag[cursor..].chars().next()?.len_utf8();
                }
                (vstart, cursor)
            } else {
                let vstart = cursor;
                while tag[cursor..].chars().next().is_some_and(|c| !c.is_ascii_whitespace() && c != '>') {
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

pub(super) fn set_html_finding_source(
    finding: &mut CrawledHtmlValidationFinding,
    source: &str,
    offset: usize,
) {
    let offset = offset.min(source.len());
    let prefix = &source[..offset];
    let line_start = prefix.rfind('\n').map_or(0, |idx| idx + 1);
    let line_end = source[offset..].find('\n').map_or(source.len(), |idx| offset + idx);
    let mut excerpt_start = line_start.max(offset.saturating_sub(100));
    let mut excerpt_end = line_end.min(offset.saturating_add(140));
    while !source.is_char_boundary(excerpt_start) { excerpt_start += 1; }
    while !source.is_char_boundary(excerpt_end) { excerpt_end -= 1; }
    finding.line = Some(prefix.bytes().filter(|b| *b == b'\n').count() + 1);
    finding.column = Some(source[line_start..offset].chars().count() + 1);
    finding.source_excerpt = Some(source[excerpt_start..excerpt_end].trim().to_string());
}
