use super::*;

#[test]
fn near_duplicate_annotation_adds_warning_for_similar_pages() {
    let mut page_a = post_processing_page("https://example.com/a");
    let mut page_b = post_processing_page("https://example.com/b");
    page_a.word_count = 25;
    page_b.word_count = 30;
    page_a.content_hash = Some("hash_a".into());
    page_a.content_simhash = Some("0000000000000001".into());
    page_b.content_simhash = Some("0000000000000003".into());

    let mut pages = vec![page_a, page_b];
    annotate_duplicates(&mut pages);

    assert!(pages[0]
        .issues
        .iter()
        .any(|i| i.message.contains("Near-duplicate content")));
    assert!(pages[1]
        .issues
        .iter()
        .any(|i| i.message.contains("Near-duplicate content")));
    assert_eq!(pages[0].issues_count, 1);
    assert_eq!(pages[1].issues_count, 1);
}

#[test]
fn near_duplicates_sorts_multiple_pairs() {
    let signatures = vec![
        (0, "0000000000000001".to_string()),
        (1, "0000000000000003".to_string()),
        (2, "0000000000000007".to_string()),
    ];
    let dups = near_duplicate_pairs(&signatures);
    assert_eq!(dups.len(), 3);
    assert_eq!(dups[0].0, 0);
    assert_eq!(dups[0].1, 1);
    assert_eq!(dups[1].0, 0);
    assert_eq!(dups[1].1, 2);
    assert_eq!(dups[2].0, 1);
    assert_eq!(dups[2].1, 2);
}
