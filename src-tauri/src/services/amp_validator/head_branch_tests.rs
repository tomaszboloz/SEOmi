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
