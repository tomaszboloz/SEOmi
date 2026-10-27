use super::*;

#[test]
fn filter_validation_handles_excessive_patterns_lengths_and_empty_previews() {
    let many_patterns = (0..101).map(|i| format!("pattern_{i}")).collect::<Vec<_>>();
    let res = validate_crawl_filters(many_patterns, Vec::new(), Vec::new());
    assert!(!res.valid);
    assert!(res.errors[0].message.contains("maximum of 100"));

    let long_pattern = "a".repeat(2049);
    let res = validate_crawl_filters(vec![long_pattern], Vec::new(), Vec::new());
    assert!(!res.valid);
    assert!(res.errors[0].message.contains("longer than 2048"));

    let res = validate_crawl_filters(Vec::new(), vec!["[".into()], Vec::new());
    assert!(!res.valid);
    assert_eq!(res.errors[0].filter, "exclude");

    let res = validate_crawl_filters(
        Vec::new(),
        Vec::new(),
        vec!["   ".into(), "https://example.com/valid".into()],
    );
    assert!(res.valid);
    assert_eq!(res.previews.len(), 1);
    assert_eq!(res.previews[0].url, "https://example.com/valid");
}
