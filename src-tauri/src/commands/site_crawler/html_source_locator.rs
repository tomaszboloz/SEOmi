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

pub(super) fn set_html_finding_source(
    finding: &mut CrawledHtmlValidationFinding,
    source: &str,
    offset: usize,
) {
    let offset = offset.min(source.len());
    let prefix = &source[..offset];
    let line_start = prefix.rfind('\n').map_or(0, |idx| idx + 1);
    let line_end = source[offset..]
        .find('\n')
        .map_or(source.len(), |idx| offset + idx);
    let mut excerpt_start = line_start.max(offset.saturating_sub(100));
    let mut excerpt_end = line_end.min(offset.saturating_add(140));
    while !source.is_char_boundary(excerpt_start) {
        excerpt_start += 1;
    }
    while !source.is_char_boundary(excerpt_end) {
        excerpt_end -= 1;
    }
    finding.line = Some(prefix.bytes().filter(|b| *b == b'\n').count() + 1);
    finding.column = Some(source[line_start..offset].chars().count() + 1);
    finding.source_excerpt = Some(source[excerpt_start..excerpt_end].trim().to_string());
}

#[path = "html_attribute_locator.rs"]
mod locator;
pub(super) use locator::*;
