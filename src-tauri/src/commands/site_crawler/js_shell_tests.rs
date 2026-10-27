use super::*;

fn shell(html: &str, words: usize) -> bool {
    looks_like_js_shell(&Html::parse_document(html), words)
}

#[test]
fn next_and_nuxt_payloads_flag_thin_pages() {
    let next = r#"<body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">{}</script>"#;
    assert!(shell(next, 3));
    let nuxt = "<body><script>window.__NUXT__={data:[]}</script></body>";
    assert!(shell(nuxt, 0));
}

#[test]
fn bundle_script_needs_an_app_root() {
    let with_root = r#"<div id="root"></div><script src="/static/js/main.abc.js?v=1"></script>"#;
    assert!(shell(with_root, 10));
    assert!(!shell(r#"<script src="/static/js/main.js"></script>"#, 10));
    assert!(!shell(
        r#"<div id="root"></div><script src="/a/vendor.js"></script>"#,
        10
    ));
    assert!(!shell(
        r#"<div id="root"></div><script src="/a/app.css"></script>"#,
        10
    ));
    assert!(!shell(
        r#"<div id="root"></div><script>var x=1</script>"#,
        10
    ));
}

#[test]
fn rich_pages_are_never_flagged() {
    let next = r#"<script id="__NEXT_DATA__">{}</script>"#;
    assert!(!shell(next, SHELL_MAX_WORDS));
}

#[test]
fn flag_is_unset_for_non_html() {
    let doc = Html::parse_document("<script id=\"__NEXT_DATA__\">{}</script>");
    let focus = CrawledPageFocus::default();
    assert_eq!(
        focus
            .clone()
            .with_js_shell(&doc, None)
            .is_js_shell_suspected,
        None
    );
    assert_eq!(
        focus.with_js_shell(&doc, Some(1)).is_js_shell_suspected,
        Some(true)
    );
}
