use super::check_external_crawl_links;
use super::command_tests::fixture;

#[tokio::test]
async fn valid_targets_are_deduplicated_after_fragment_normalization() {
    let app = fixture();
    let targets = [
        "https://dedup-target.invalid/page#first",
        "https://dedup-target.invalid/page#second",
        "https://dedup-target.invalid/other",
    ];
    let batch = check_external_crawl_links(
        app.handle(),
        "normalized".into(),
        targets.map(String::from).to_vec(),
        Some(1),
    )
    .await
    .unwrap();
    assert_eq!((batch.requested, batch.checked, batch.omitted), (2, 1, 1));
    assert_eq!(batch.results[0].url, "https://dedup-target.invalid/page");
}
