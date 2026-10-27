use super::metadata;
use scraper::Html;

#[test]
fn fragments_with_charset_but_without_a_head_skip_the_position_check() {
    let mut findings = Vec::new();
    metadata::check(
        &Html::parse_fragment(r#"<meta charset="utf-8"><p>no head</p>"#),
        &mut findings,
    );
    let codes = findings.iter().map(|f| f.code.as_str()).collect::<Vec<_>>();
    assert!(!codes.contains(&"amp-charset-missing"));
    assert!(!codes.contains(&"amp-charset-position"));
}

#[test]
fn noscript_blocks_need_both_style_and_boilerplate_marker() {
    let codes_for = |noscript: &str| {
        super::audit_amp(
            &format!("<html amp><head>{noscript}</head><body></body></html>"),
            "https://example.test/",
        )
        .findings
        .into_iter()
        .map(|f| f.code)
        .collect::<Vec<_>>()
    };
    let missing = "amp-noscript-boilerplate-missing".to_string();
    assert!(codes_for("<noscript><style>a{}</style></noscript>").contains(&missing));
    let both = "<noscript><style>a{}</style></noscript><noscript><style amp-boilerplate>a{}</style></noscript>";
    assert!(!codes_for(both).contains(&missing));
}
