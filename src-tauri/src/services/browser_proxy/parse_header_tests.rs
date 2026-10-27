use super::parse::parse_request_head;

fn head(header_line: &str) -> Result<(), u16> {
    parse_request_head(&format!(
        "GET http://example.test/ HTTP/1.1\r\n{header_line}"
    ))
    .map(|_| ())
}

#[test]
fn header_lines_reject_empty_names_bad_tokens_and_control_values() {
    assert_eq!(head(": value"), Err(400));
    assert_eq!(head("Bad Name: value"), Err(400));
    assert_eq!(head("X-Test: a\u{1}b"), Err(400));
    assert_eq!(head("X-Test: a\u{7f}b"), Err(400));
    assert_eq!(head("X-Test: a\0b"), Err(400));
    assert_eq!(head("no-colon"), Err(400));
}

#[test]
fn header_lines_allow_tabs_and_blank_separators() {
    assert_eq!(head("X-Test: a\tb"), Ok(()));
    assert_eq!(head(""), Ok(()));
}
