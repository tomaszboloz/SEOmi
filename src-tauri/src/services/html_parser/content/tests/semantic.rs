use super::*;

#[test]
fn semantic_root_and_chrome_detection_use_tags_roles_and_known_markers() {
    for opening in [
        "<main>",
        "<article>",
        "<div role='MAIN'>",
        "<div itemprop='articleBody'>",
        "<div class='entry-content'>",
        "<div id='main-content'>",
    ] {
        let source = format!("{opening}Content</div>");
        let doc = Html::parse_fragment(&source);
        let selector = Selector::parse("main, article, div").unwrap();
        let element = doc.select(&selector).next().unwrap();
        assert!(semantic_content_root(&element), "{opening}");
        assert!(semantic_content_contains(&element, true), "{opening}");
        assert!(!semantic_chrome_element(&element), "{opening}");
    }
    for opening in [
        "<nav>",
        "<div role='navigation'>",
        "<div class='cookie-banner'>",
        "<div hidden>",
        "<div inert>",
        "<div style='display:none'>",
        "<div aria-hidden='true'>",
    ] {
        let doc = Html::parse_fragment(opening);
        let selector = Selector::parse("nav, div").unwrap();
        let element = doc.select(&selector).next().unwrap();
        assert!(semantic_chrome_element(&element), "{opening}");
        assert!(!semantic_content_contains(&element, false), "{opening}");
    }
}

#[test]
fn visible_content_excludes_payload_ancestors_and_normalizes_space() {
    let doc = Html::parse_document("<p>Outside</p><main><p> Visible   text </p><script>secret</script><style>secret</style><svg><text>secret</text></svg><form>secret</form></main>");
    assert!(has_semantic_content_root(&doc));
    assert_eq!(visible_content_text(&doc).as_deref(), Some("Visible text"));
    let selector = Selector::parse("p").unwrap();
    let outside = doc.select(&selector).next().unwrap();
    assert!(!semantic_content_contains(&outside, true));
    assert!(semantic_content_contains(&outside, false));
    assert!(!semantic_content_root(&outside));
    assert!(!semantic_chrome_element(&outside));
    assert_eq!(
        visible_content_text(&Html::parse_fragment("<p>fragment</p>")),
        None
    );
}
