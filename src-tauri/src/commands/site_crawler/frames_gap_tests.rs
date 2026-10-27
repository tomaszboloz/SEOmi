use super::*;

#[test]
fn frame_collection_truncates_at_the_per_page_limit() {
    let html = "<iframe src=\"/a\"></iframe>".repeat(MAX_IFRAMES_PER_PAGE + 1);
    let document = Html::parse_document(&html);
    let base = url::Url::parse("https://example.com/").unwrap();
    let (frames, truncated) = crawl_frames(&document, &base);
    assert!(truncated);
    assert_eq!(frames.len(), MAX_IFRAMES_PER_PAGE);
}
