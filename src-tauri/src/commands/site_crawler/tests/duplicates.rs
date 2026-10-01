use super::*;

#[test]
fn duplicate_heading_detection_normalizes_whitespace_and_case_and_keeps_levels() {
    let document = Html::parse_document(
        "<h2> Quick   Start </h2><h3>quick start</h3><h2>QUICK START</h2><h4>Other</h4><h5> </h5>",
    );
    let selector = Selector::parse("h1, h2, h3, h4, h5, h6").unwrap();

    let duplicates = duplicate_heading_groups(&document, &selector);

    assert_eq!(duplicates.len(), 1);
    assert_eq!(duplicates[0].text, "Quick Start");
    assert_eq!(duplicates[0].levels, vec![2, 3]);
    assert_eq!(duplicates[0].occurrences, 3);
}

#[test]
fn duplicate_text_detection_trims_and_normalizes_case_while_ignoring_empty_fields() {
    let duplicates = duplicate_text_indices([
        Some(" Shared description "),
        None,
        Some("shared description"),
        Some(""),
        Some("Different description"),
    ]);

    assert_eq!(duplicates.len(), 1);
    assert_eq!(duplicates[0], vec![0, 2]);
}

#[test]
fn normalizes_whitespace_and_case_when_fingerprinting_content() {
    let first = Html::parse_document("<html><body>Hello   WORLD</body></html>");
    let second = Html::parse_document("<html><body>hello world</body></html>");
    assert_eq!(
        normalized_content_fingerprint(&first),
        normalized_content_fingerprint(&second)
    );
}

#[test]
fn simhash_near_duplicate_pairs_use_a_visible_hamming_threshold() {
    let pairs = near_duplicate_pairs(&[
        (0, "0000000000000000".into()),
        (1, "0000000000000003".into()),
        (2, "ffffffffffffffff".into()),
    ]);

    assert_eq!(pairs, vec![(0, 1, 2)]);
    assert_eq!(
        simhash_distance("0000000000000000", "0000000000000003"),
        Some(2)
    );
}

#[test]
fn simhash_is_stable_for_normalized_document_text() {
    let first = Html::parse_document("<html><body>One TWO three four five six</body></html>");
    let second = Html::parse_document("<html><body>one two   three four five six</body></html>");

    assert_eq!(content_simhash(&first), content_simhash(&second));
}

#[test]
fn duplicate_descriptions_are_reported_once_per_page() {
    let mut pages = vec![
        post_processing_page("https://example.com/a"),
        post_processing_page("https://example.com/b"),
        post_processing_page("https://example.com/c"),
    ];
    pages[0].meta_description = Some(" Shared description ".into());
    pages[1].meta_description = Some("shared DESCRIPTION".into());
    pages[2].meta_description = Some("Distinct description".into());
    annotate_duplicates(&mut pages);
    for page in &pages[..2] {
        assert_eq!(
            page.issues
                .iter()
                .filter(|issue| issue.message == "Duplicate meta description found in this crawl")
                .count(),
            1
        );
        assert_eq!(page.issues_count, page.issues.len());
    }
    assert!(pages[2].issues.is_empty());
}

#[test]
fn empty_descriptions_do_not_create_duplicate_findings() {
    let mut pages = vec![
        post_processing_page("https://example.com/a"),
        post_processing_page("https://example.com/b"),
    ];
    pages[0].meta_description = Some("  ".into());
    pages[1].meta_description = Some("".into());
    annotate_duplicates(&mut pages);
    assert!(pages
        .iter()
        .all(|page| page.issues.is_empty() && page.issues_count == 0));
}

#[test]
fn exact_content_duplicate_annotation_updates_each_page_once() {
    let mut pages = vec![
        post_processing_page("https://example.com/a"),
        post_processing_page("https://example.com/b"),
        post_processing_page("https://example.com/c"),
    ];
    pages[0].content_hash = Some("same".into());
    pages[1].content_hash = Some("same".into());
    pages[2].content_hash = Some("different".into());
    annotate_duplicates(&mut pages);
    for page in &pages[..2] {
        assert_eq!(
            page.issues
                .iter()
                .filter(|issue| issue.message.contains("Duplicate normalized page content"))
                .count(),
            1
        );
        assert_eq!(page.issues_count, page.issues.len());
    }
    assert!(pages[2].issues.is_empty());
}
