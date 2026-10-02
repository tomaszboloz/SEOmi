use super::*;

#[test]
fn content_statistics_ignore_site_chrome_and_forms_when_semantic_root_exists() {
    let parsed = parse_html(
        r#"<html><body>
            <header>Header keyword should not count</header>
            <nav>Navigation keyword should not count</nav>
            <aside>Sidebar keyword should not count</aside>
            <form><p>Form keyword should not count</p></form>
            <main><article><p>Main content target.</p></article></main>
            <footer>Footer keyword should not count</footer>
        </body></html>"#,
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.content_stats.word_count, 3);
    assert_eq!(parsed.content_stats.body_text, "Main content target.");
    assert!(!parsed.content_stats.body_text.contains("keyword"));
    assert!(parsed
        .content_stats
        .top_keywords
        .iter()
        .all(|keyword| !keyword.keyword.contains("keyword")));
}
