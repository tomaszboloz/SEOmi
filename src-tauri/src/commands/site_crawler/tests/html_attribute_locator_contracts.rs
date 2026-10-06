use super::*;

fn locate(
    source: &str,
    element: &str,
    attribute: &str,
    expected: &str,
    occurrence: usize,
) -> Option<usize> {
    locate_html_attribute(
        source,
        &source.to_ascii_lowercase(),
        element,
        attribute,
        expected,
        occurrence,
    )
}

#[test]
fn locates_case_insensitive_quoted_and_unquoted_attributes_at_exact_offsets() {
    let source = r#"<DIV DATA-ID = 'target' aria-label=target disabled><div data-id=target>"#;
    let first = source.find("target").unwrap();
    assert_eq!(locate(source, "div", "data-id", "target", 0), Some(first));
    let second = source.rfind("target").unwrap();
    assert_eq!(locate(source, "DIV", "DATA-ID", "target", 1), Some(second));
    let aria = source.find("aria-label=target").unwrap() + "aria-label=".len();
    assert_eq!(locate(source, "div", "aria-label", "target", 0), Some(aria));
    assert_eq!(locate(source, "div", "disabled", "", 0), None);
}

#[test]
fn honors_element_boundaries_and_skips_malformed_occurrences() {
    let source = r#"<divish data-id="wrong"><div data-id="one"><span title='x>y'><div data-id=two"#;
    assert_eq!(
        locate(source, "div", "data-id", "one", 0),
        Some(source.find("one").unwrap())
    );
    assert_eq!(locate(source, "div", "data-id", "two", 0), None);
    assert_eq!(locate(source, "div", "missing", "x", 0), None);
    assert_eq!(locate(source, "div", "data-id", "one", 1), None);
}

#[test]
fn rejects_attribute_substrings_missing_equals_and_unquoted_boundaries() {
    let source =
        r#"<input data-id="no" id-other="no" id="yes" data-id2="no"><input id value="no">"#;
    assert_eq!(
        locate(source, "input", "id", "yes", 0),
        Some(source.find("yes").unwrap())
    );
    assert_eq!(locate(source, "input", "id", "yes", 1), None);
    assert_eq!(locate(source, "input", "id", "no", 0), None);
    assert_eq!(
        locate(source, "input", "data-id", "no", 0),
        Some(source.find("no").unwrap())
    );
}
