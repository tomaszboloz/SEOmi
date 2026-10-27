use super::*;

fn reason(html: &str, words: usize) -> Option<JsShellReason> {
    detect_js_shell(&Html::parse_document(html), words).map(|signal| signal.reason)
}

fn shell(html: &str, words: usize) -> bool {
    reason(html, words).is_some()
}

#[test]
fn hydration_payloads_flag_thin_pages_with_reason() {
    let next = r#"<body><div id="__next"></div><script id="__NEXT_DATA__" type="application/json">{}</script>"#;
    assert_eq!(reason(next, 3), Some(JsShellReason::NextData));
    let nuxt = "<body><script>window.__NUXT__={data:[]}</script></body>";
    assert_eq!(reason(nuxt, 0), Some(JsShellReason::NuxtPayload));
    let nuxt3 = r#"<script type="application/json" id="__NUXT_DATA__">[]</script>"#;
    assert_eq!(reason(nuxt3, 0), Some(JsShellReason::NuxtPayload));
    let redux = "<script>window.__INITIAL_STATE__ = {};</script>";
    assert_eq!(reason(redux, 0), Some(JsShellReason::InitialState));
    let preloaded = "<script>window.__PRELOADED_STATE__={}</script>";
    assert_eq!(reason(preloaded, 0), Some(JsShellReason::InitialState));
}

#[test]
fn bundle_script_needs_an_empty_app_root() {
    let with_root = r#"<div id="root"></div><script src="/static/js/main.abc.js?v=1"></script>"#;
    assert_eq!(reason(with_root, 10), Some(JsShellReason::BundleEmptyRoot));
    let filled_root = r#"<div id="app"><p>Server text</p></div><script src="/app.js"></script>"#;
    assert!(!shell(filled_root, 10));
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
    let skipped = focus.clone().with_js_shell(&doc, None);
    assert_eq!(skipped.is_js_shell_suspected, None);
    assert_eq!(skipped.js_shell_reason, None);
    let flagged = focus.with_js_shell(&doc, Some(1));
    assert_eq!(flagged.is_js_shell_suspected, Some(true));
    assert_eq!(flagged.js_shell_reason, Some(JsShellReason::NextData));
    assert_eq!(
        flagged.spa_payload, None,
        "empty payload yields no evidence"
    );
}

#[test]
fn non_shell_html_records_false_without_reason_or_payload() {
    let doc = Html::parse_document("<p>Plain page</p>");
    let focus = CrawledPageFocus::default().with_js_shell(&doc, Some(2));
    assert_eq!(focus.is_js_shell_suspected, Some(false));
    assert_eq!(focus.js_shell_reason, None);
    assert_eq!(focus.spa_payload, None);
}

#[test]
fn next_fixture_exposes_payload_with_provenance() {
    let html = r#"<html><body><div id="__next"></div>
<script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{
"post":{"title":"Hello SPA","body":"<p>Real article text lives here.</p>",
"related":[{"href":"/blog/second"}]}}},"buildId":"build id with spaces here"}</script></body></html>"#;
    let doc = Html::parse_document(html);
    let focus = CrawledPageFocus::default().with_js_shell(&doc, Some(0));
    let payload = focus.spa_payload.expect("payload parsed");
    assert_eq!(payload.provenance, "payload");
    assert_eq!(payload.source, "__NEXT_DATA__");
    assert_eq!(payload.title.as_deref(), Some("Hello SPA"));
    assert_eq!(payload.text, "Real article text lives here.");
    assert_eq!(payload.word_count, 5);
    assert_eq!(payload.links, vec!["/blog/second".to_string()]);
    assert!(!payload.truncated);
}

#[test]
fn bundle_shell_has_reason_but_no_payload() {
    let doc = Html::parse_document(r#"<div id="root"> </div><script src="/chunk.1.js"></script>"#);
    let focus = CrawledPageFocus::default().with_js_shell(&doc, Some(0));
    assert_eq!(focus.js_shell_reason, Some(JsShellReason::BundleEmptyRoot));
    assert_eq!(focus.spa_payload, None);
}
