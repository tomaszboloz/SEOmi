use super::*;

#[test]
fn ignores_dynamic_subtrees_and_keeps_structural_difference() {
    let a = Html::parse_document("<html><body><main><article><h1>T</h1><script>x()</script><p>P</p></article></main></body></html>");
    let b = Html::parse_document(
        "<html><body><main><section><h1>T</h1><p>P</p></section></main></body></html>",
    );
    assert!(!signature(&a).unwrap().contains("script"));
    assert_ne!(signature(&a), signature(&b));
}

#[test]
fn captures_declared_values_and_omits_unavailable_evidence() {
    let doc = Html::parse_document("<html><head><meta name='template:variable' content='krakow'><meta name='tas:subtopic' content='local'></head><body><p>P</p></body></html>");
    let attached = attach(CrawledPageFocus::default(), &doc, true);
    assert_eq!(
        attached.template_injected_variables.as_deref(),
        Some(["krakow".to_string()].as_slice())
    );
    assert_eq!(attached.tas_subtopic_id.as_deref(), Some("local"));
    let unavailable = attach(CrawledPageFocus::default(), &doc, false);
    assert!(unavailable.template_dom_signature.is_none());
    assert!(signature(&Html::parse_fragment("<main>P</main>")).is_none());
}

fn page(article: &str, aside: &str) -> Html {
    Html::parse_document(&format!(
        "<html><body><header><nav><a href='/'>H</a></nav></header><main><article><h1>T</h1>{article}</article>{aside}</main><footer><p>F</p></footer></body></html>"
    ))
}

#[test]
fn same_template_with_different_content_counts_shares_a_signature() {
    let short = page("<p>Krakow</p><ul><li>a</li></ul>", "");
    let long = page(
        "<ul><li>a</li><li>b</li><li>c</li></ul><p><strong>Gdansk</strong> <a href='/x'>x</a></p><p>more</p><p>even more</p>",
        "",
    );
    assert_eq!(signature(&short), signature(&long));
}

#[test]
fn different_layout_or_deep_budget_keeps_signatures_apart_and_bounded() {
    let plain = page("<p>P</p>", "");
    let sidebar = page("<p>P</p>", "<aside><form><input></form></aside>");
    assert_ne!(signature(&plain), signature(&sidebar));
    let deep = Html::parse_document(&format!(
        "<html><body>{}x{}</body></html>",
        "<div>".repeat(40),
        "</div>".repeat(40)
    ));
    let sig = signature(&deep).unwrap();
    assert_eq!(sig.matches("div").count(), MAX_DEPTH);
    let wide = Html::parse_document(&format!(
        "<html><body>{}</body></html>",
        (0..2000)
            .map(|i| format!("<section id='{i}'><p>x</p></section>"))
            .collect::<String>()
    ));
    assert_eq!(signature(&wide).unwrap(), "body(section(p))");
}
