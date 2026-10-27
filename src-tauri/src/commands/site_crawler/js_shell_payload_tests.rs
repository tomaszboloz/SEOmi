use super::*;

#[test]
fn nuxt3_array_payload_yields_prose_only() {
    let script = r#"[{"data":1},"Nuxt rendered product description text","short","/about"]"#;
    let payload = extract("__NUXT_DATA__", script).expect("payload");
    assert_eq!(payload.source, "__NUXT_DATA__");
    assert_eq!(payload.text, "Nuxt rendered product description text");
    assert_eq!(payload.word_count, 5);
    assert!(payload.links.is_empty(), "links need a link-like key");
    assert_eq!(payload.title, None);
}

#[test]
fn assignment_payloads_parse_with_trailing_statements() {
    let script = r#"window.__INITIAL_STATE__ = {"page":{"headline":"Store headline","url":"https://ex.com/a?b=1"}};boot();"#;
    let payload = extract("__INITIAL_STATE__", script).expect("payload");
    assert_eq!(payload.title.as_deref(), Some("Store headline"));
    assert_eq!(payload.links, vec!["https://ex.com/a?b=1".to_string()]);
    assert!(payload.text.is_empty());
}

#[test]
fn non_json_or_empty_payloads_are_absent() {
    assert_eq!(
        extract("__NUXT__", "window.__NUXT__=(function(a){return {}}(1))"),
        None
    );
    assert_eq!(extract("__NUXT__", "window.__NUXT__"), None);
    assert_eq!(extract("__NUXT__", "var other = 1"), None);
    assert_eq!(
        extract("__INITIAL_STATE__", "window.__INITIAL_STATE__ = 5"),
        None
    );
    assert_eq!(extract("__NEXT_DATA__", r#"{"props":{"n":1}}"#), None);
}

#[test]
fn only_next_payloads_start_at_props() {
    let script = r#"{"title":"Root","props":{"title":"Props"}}"#;
    let nuxt = extract("__NUXT_DATA__", script).expect("payload");
    assert_eq!(nuxt.title.as_deref(), Some("Root"));
    let next = extract("__NEXT_DATA__", script).expect("payload");
    assert_eq!(next.title.as_deref(), Some("Props"));
    assert_eq!(extract("__NUXT__", "window.__NUXT__ =   "), None);
}

#[test]
fn next_payload_without_props_walks_root() {
    let payload = extract("__NEXT_DATA__", r#"{"page":{"title":"Root title"}}"#).expect("payload");
    assert_eq!(payload.title.as_deref(), Some("Root title"));
}

#[test]
fn links_filter_assets_whitespace_and_protocol_relative() {
    let script = r#"{"a":[{"href":"/x.js"},{"href":"//cdn/x"},{"path":"/has space"},
{"link":"mailto:x"},{"url":"/ok"},{"url":"/ok"},{"canonical":"http://ex.com/c"}]}"#;
    let payload = extract("__NEXT_DATA__", script).expect("payload");
    assert_eq!(
        payload.links,
        vec!["/ok".to_string(), "http://ex.com/c".to_string()]
    );
}

#[test]
fn titles_prefer_shallowest_and_skip_empty_or_long() {
    let long = "x".repeat(MAX_TITLE_CHARS + 1);
    let script = format!(
        r#"{{"a":{{"title":"Deep"}},"title":" ","seoTitle":"{long}","b":{{"metaTitle":"Mid"}}}}"#
    );
    let payload = extract("__NEXT_DATA__", &script).expect("payload");
    assert_eq!(payload.title.as_deref(), Some("Deep"));
}

#[test]
fn prose_is_deduplicated_and_needs_letters() {
    let script = r#"{"a":"one two three","b":"one  two three","c":"1 2 3 4","d":"a < b three"}"#;
    let payload = extract("__NEXT_DATA__", script).expect("payload");
    assert_eq!(payload.text, "one two three\na < b three");
    assert_eq!(payload.word_count, 7);
}

#[test]
fn bounds_mark_payload_truncated() {
    let sentence = |i: usize| format!("\"sentence number {i} {}\"", "w".repeat(40));
    let many: Vec<String> = (0..100).map(sentence).collect();
    let text = extract("__NEXT_DATA__", &format!("[{}]", many.join(","))).expect("payload");
    assert!(text.truncated);
    assert!(text.text.chars().count() <= MAX_TEXT_CHARS);
    assert_eq!(text.word_count, 400, "word count covers all prose found");

    let links: Vec<String> = (0..=MAX_LINKS)
        .map(|i| format!(r#"{{"href":"/p{i}"}}"#))
        .collect();
    let linked = extract("__NEXT_DATA__", &format!("[{}]", links.join(","))).expect("payload");
    assert!(linked.truncated);
    assert_eq!(linked.links.len(), MAX_LINKS);

    let nodes = format!("[{}]", vec!["1"; MAX_NODES].join(","));
    let big = format!(r#"{{"title":"T","z":{nodes}}}"#);
    assert!(extract("__NEXT_DATA__", &big).expect("payload").truncated);
}
