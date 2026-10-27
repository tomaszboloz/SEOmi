use super::fixture::synthetic;
use super::tests::text_of;
use serde_json::json;

#[test]
fn cancelled_runs_and_robots_warnings_are_called_out() {
    let mut run = synthetic(12);
    run["result"]["cancelled"] = json!(true);
    run["result"]["robots_txt_warning"] = json!("robots.txt could not be evaluated");
    let text = text_of(&run);
    assert!(text.contains("This crawl was cancelled before it finished; results are partial."));
    assert!(text.contains("robots.txt warning: robots.txt could not be evaluated"));
}

#[test]
fn report_templates_limit_the_sections_like_the_old_export() {
    let mut run = synthetic(20);
    run["report_template_sections"] = json!(["summary", "issues"]);
    let text = text_of(&run);
    assert!(text.contains("What to fix first") && text.contains("Duplicate titles"));
    for part in [
        "All crawled pages",
        "Crawl configuration",
        "Broken links",
        "Image problems",
        "HTTP response details",
    ] {
        assert!(!text.contains(part), "unexpected: {part}");
    }
    run["report_template_sections"] = json!([
        "pages",
        "links",
        "images",
        "resources",
        "frames",
        "custom-search",
        "configuration"
    ]);
    let text = text_of(&run);
    for part in [
        "All crawled pages",
        "Crawl configuration",
        "Broken links",
        "Image problems",
        "Resources",
        "Frames",
        "Custom search",
    ] {
        assert!(text.contains(part), "missing: {part}");
    }
    assert!(!text.contains("What to fix first") && !text.contains("Duplicate titles"));
}

#[test]
fn long_urls_survive_wrapping() {
    let text = text_of(&synthetic(20));
    assert!(text.contains(&format!(
        "{}/page-0?ref={}",
        "category/".repeat(8),
        "x".repeat(60)
    )));
}
