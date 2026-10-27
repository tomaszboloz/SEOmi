use super::*;

#[test]
fn captures_bounded_native_skeleton_without_dynamic_nodes() {
    let doc = Html::parse_document("<html><body><main><article><h1>Title</h1><script>x()</script><p>Text</p><svg><path/></svg></article></main></body></html>");
    let sig = signature(&doc).unwrap();
    assert!(sig.starts_with("0:body>") && sig.contains("article") && !sig.contains("script"));
    assert!(!sig.contains("path") && !sig.contains("svg"));
}

#[test]
fn two_fixtures_with_different_svg_and_dynamic_nodes_produce_same_signature() {
    let doc_a = Html::parse_document(
        r#"<html><body><main><article>
            <h1>Heading</h1>
            <svg viewBox="0 0 100 100"><path d="M10 10 H 90 V 90 H 10 Z"/></svg>
            <p>Main content paragraph</p>
        </article></main></body></html>"#,
    );
    let doc_b = Html::parse_document(
        r#"<html><body><main><article>
            <h1>Heading</h1>
            <svg viewBox="0 0 200 200">
                <g id="layer1"><circle cx="50" cy="50" r="40"/><path d="M0 0 L100 100"/></g>
            </svg>
            <script type="application/json">{"dynamic": true}</script>
            <noscript><span>Enable JavaScript</span></noscript>
            <style>.theme { display: block; }</style>
            <template><div class="modal">Modal template</div></template>
            <p>Main content paragraph</p>
        </article></main></body></html>"#,
    );
    let sig_a = signature(&doc_a).expect("signature a");
    let sig_b = signature(&doc_b).expect("signature b");
    assert_eq!(sig_a, sig_b);
}

#[test]
fn real_structural_difference_produces_separate_signatures() {
    let doc_a = Html::parse_document(
        r#"<html><body><main><article>
            <h1>Heading</h1><p>Main content paragraph</p>
        </article></main></body></html>"#,
    );
    let doc_c = Html::parse_document(
        r#"<html><body><main><section>
            <h1>Heading</h1><p>Main content paragraph</p>
        </section></main></body></html>"#,
    );
    let sig_a = signature(&doc_a).expect("signature a");
    let sig_c = signature(&doc_c).expect("signature c");
    assert_ne!(sig_a, sig_c);
}

#[test]
fn returns_unavailable_without_body() {
    assert!(signature(&Html::parse_fragment("<main>content</main>")).is_none());
}

#[test]
fn extracts_declared_variables_and_subtopic_honestly() {
    let doc = Html::parse_document(
        r#"<html><head><meta name="template:variable" content="krakow">
        <meta name="tas:subtopic" content="dieta-cukrzycowa"></head>
        <body><span data-template-var="30-dni">30 dni</span></body></html>"#,
    );
    let vars = extract_injected_variables(&doc).unwrap();
    assert_eq!(vars, vec!["krakow".to_string(), "30-dni".to_string()]);
    assert_eq!(
        extract_tas_subtopic_id(&doc).as_deref(),
        Some("dieta-cukrzycowa")
    );

    let empty_doc = Html::parse_document("<html><body><p>plain</p></body></html>");
    assert!(extract_injected_variables(&empty_doc).is_none());
    assert!(extract_tas_subtopic_id(&empty_doc).is_none());

    let attached = attach(CrawledPageFocus::default(), &doc, true);
    assert!(attached.template_dom_signature.is_some());
    assert_eq!(
        attached.template_injected_variables.as_deref().unwrap(),
        ["krakow", "30-dni"]
    );
    assert_eq!(
        attached.tas_subtopic_id.as_deref(),
        Some("dieta-cukrzycowa")
    );

    let unavailable = attach(CrawledPageFocus::default(), &doc, false);
    assert!(unavailable.template_dom_signature.is_none());
    assert!(unavailable.template_injected_variables.is_none());
    assert!(unavailable.tas_subtopic_id.is_none());

    let json = serde_json::to_string(&attached).unwrap();
    assert!(json.contains("\"template_dom_signature\""));
    assert!(json.contains("\"template_injected_variables\":[\"krakow\",\"30-dni\"]"));
    assert!(json.contains("\"tas_subtopic_id\":\"dieta-cukrzycowa\""));

    let unavail_json = serde_json::to_string(&unavailable).unwrap();
    assert!(!unavail_json.contains("template_dom_signature"));
    assert!(!unavail_json.contains("template_injected_variables"));
    assert!(!unavail_json.contains("tas_subtopic_id"));
}
