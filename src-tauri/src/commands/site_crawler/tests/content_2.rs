use super::*;

#[test]
fn semantic_extraction_uses_main_content_and_excludes_site_chrome() {
    let document = Html::parse_document(
        r#"<html><body><header><nav><a href="/global">globalnavigation</a></nav></header><aside class="sidebar">sidebarkeyword</aside><main><h1>Espresso brewing</h1><article><p>Espresso brewing requires precise grinding and fresh coffee beans.</p><a href="/grinding">grinding guide</a></article><form><label>formkeyword</label></form><div role="search">searchformkeyword</div><footer>footerkeyword</footer></main><footer>sitefooterkeyword</footer></body></html>"#,
    );
    let terms = extract_semantic_terms(&document, None);
    let excerpts = extract_semantic_excerpts(&document);
    assert!(terms.contains(&"espresso".to_string()));
    assert!(terms.contains(&"grinding".to_string()));
    assert!(excerpts
        .iter()
        .any(|excerpt| excerpt.contains("Espresso brewing requires precise grinding")));
    assert!(!terms.contains(&"globalnavigation".to_string()));
    assert!(!terms.contains(&"sidebarkeyword".to_string()));
    assert!(!terms.contains(&"footerkeyword".to_string()));
    assert!(!terms.contains(&"formkeyword".to_string()));
    assert!(!terms.contains(&"searchformkeyword".to_string()));
    assert!(!excerpts
        .iter()
        .any(|excerpt| excerpt.contains("globalnavigation")));
    assert!(!excerpts
        .iter()
        .any(|excerpt| excerpt.contains("footerkeyword")));
    assert!(!terms.contains(&"sitefooterkeyword".to_string()));

    let anchor_selector = Selector::parse("a").unwrap();
    let anchors = document.select(&anchor_selector).collect::<Vec<_>>();
    assert!(!semantic_content_contains(&anchors[0], true));
    assert!(semantic_content_contains(&anchors[1], true));

    let fallback_document = Html::parse_document(
        r#"<html><body><header>globalheaderterm</header><nav>globalnavigationterm</nav><div class="sidebar">sidebarkeyword</div><p>Fallback article content discusses espresso machines and coffee extraction.</p><footer>globalfooterterm</footer></body></html>"#,
    );
    let fallback_terms = extract_semantic_terms(&fallback_document, None);
    let fallback_excerpts = extract_semantic_excerpts(&fallback_document);
    assert!(fallback_terms.contains(&"espresso".to_string()));
    assert!(fallback_excerpts
        .iter()
        .any(|excerpt| excerpt.contains("Fallback article content discusses espresso")));
    assert!(!fallback_terms.contains(&"globalheaderterm".to_string()));
    assert!(!fallback_terms.contains(&"globalnavigationterm".to_string()));
    assert!(!fallback_terms.contains(&"sidebarkeyword".to_string()));
    assert!(!fallback_terms.contains(&"globalfooterterm".to_string()));
}

#[test]
fn link_source_excerpt_is_bounded_and_redacts_values_and_handlers() {
    let document = Html::parse_document(
        r#"<html><body><main><a href="/broken" value="secret-value" onclick="sendSecret()">Broken destination</a></main></body></html>"#,
    );
    let anchor = document
        .select(&Selector::parse("a").unwrap())
        .next()
        .expect("anchor fixture should exist");
    let excerpt = bounded_link_source_excerpt(&anchor).expect("excerpt should exist");
    assert!(excerpt.contains("/broken"));
    assert!(excerpt.contains("[redacted]"));
    assert!(!excerpt.contains("secret-value"));
    assert!(!excerpt.contains("sendSecret"));
    assert!(excerpt.chars().count() <= 800);
}

#[test]
fn semantic_extraction_handles_rendered_dom_visibility_and_dynamic_chrome() {
    // This mirrors the HTML captured after a browser-rendered page has
    // hydrated. Dynamic content belongs to <main>; consent/navigation
    // fragments and hidden app shells must not influence semantic terms,
    // excerpts, or content-only graph links.
    let rendered_dom = r#"
            <html><body>
              <header><p>headerchromemarker</p></header>
              <nav><a href="/nav">navchromemarker</a></nav>
              <aside><p>sidebarchromemarker</p></aside>
              <div class="cookie-consent"><p>consentchromemarker</p></div>
              <main>
                <h1>Dynamic semantic content</h1>
                <p>Hydrated content about technical audits and crawl diagnostics.</p>
                <a href="/guide">Read the crawl diagnostics guide</a>
                <div hidden><p>hiddeninjectedmarker</p><a href="/hidden">hidden link</a></div>
                <div inert><p>inertinjectedmarker</p><a href="/inert">inert link</a></div>
                <div aria-hidden="1"><p>ariahiddenmarker</p><a href="/aria-hidden">aria hidden link</a></div>
                <div style="display:none!important"><p>displaynonemarker</p><a href="/display-none">display none link</a></div>
                <div style="visibility: hidden"><p>visibilityhiddenmarker</p><a href="/visibility-hidden">visibility hidden link</a></div>
                <div style="content-visibility:hidden"><p>contenthiddenmarker</p><a href="/content-hidden">content hidden link</a></div>
              </main>
              <footer><p>dynamic footer keyword</p></footer>
            </body></html>
        "#;
    let document = Html::parse_document(rendered_dom);
    let terms = extract_semantic_terms(&document, None);
    let excerpts = extract_semantic_excerpts(&document);
    assert!(terms.contains(&"hydrated".to_string()));
    assert!(terms.contains(&"diagnostics".to_string()));
    for excluded in [
        "headerchromemarker",
        "navchromemarker",
        "sidebarchromemarker",
        "consentchromemarker",
        "hiddeninjectedmarker",
        "inertinjectedmarker",
        "ariahiddenmarker",
        "displaynonemarker",
        "visibilityhiddenmarker",
        "contenthiddenmarker",
    ] {
        assert!(!terms.contains(&excluded.to_string()), "{excluded}");
    }
    assert!(excerpts
        .iter()
        .any(|excerpt| excerpt.contains("Hydrated content about technical audits")));
    assert!(!excerpts
        .iter()
        .any(|excerpt| excerpt.contains("hiddeninjectedmarker")));

    let anchor_selector = Selector::parse("a").unwrap();
    let anchors = document.select(&anchor_selector).collect::<Vec<_>>();
    assert!(anchors
        .iter()
        .any(|anchor| anchor.value().attr("href") == Some("/guide")
            && semantic_content_contains(anchor, true)));
    for hidden_href in [
        "/nav",
        "/hidden",
        "/inert",
        "/aria-hidden",
        "/display-none",
        "/visibility-hidden",
        "/content-hidden",
    ] {
        let anchor = anchors
            .iter()
            .find(|anchor| anchor.value().attr("href") == Some(hidden_href))
            .expect("fixture link should exist");
        assert!(!semantic_content_contains(anchor, true), "{hidden_href}");
    }
    assert_eq!(
        semantic_content_source(&document, true, false, false),
        "primary-root"
    );
}
