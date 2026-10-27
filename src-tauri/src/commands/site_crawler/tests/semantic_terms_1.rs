use super::*;

#[test]
fn semantic_extraction_drops_function_words_numbers_and_date_chrome() {
    let document = Html::parse_document(
        r#"<html lang="pl"><body><main><p>Ale jeśli szkolenie B2B, to więcej niż 2026 i 000 osób. 12 wrz 2026. Czytaj więcej.</p><p>Because the training covers only B2B prospecting, 5000 times.</p></main></body></html>"#,
    );
    let terms = extract_semantic_terms(&document, Some("pl-PL"));
    for excluded in [
        "ale", "jeśli", "więcej", "niż", "2026", "000", "wrz", "czytaj", "because", "the", "only",
        "5000",
    ] {
        assert!(!terms.contains(&excluded.to_string()), "{excluded}");
    }
    for kept in ["szkolenie", "b2b", "training", "prospecting"] {
        assert!(terms.contains(&kept.to_string()), "{kept}");
    }
}

#[test]
fn semantic_extraction_merges_polish_inflections_into_most_frequent_form() {
    let document = Html::parse_document(
        r#"<html><body><main><p>Szkolenia z LinkedIn. Szkolenia dla firm. Program szkoleń i opis szkolenia. Po szkoleniu. Konsultacje, konsultacje.</p></main></body></html>"#,
    );
    let terms = extract_semantic_terms(&document, Some("pl"));
    assert_eq!(terms.first().map(String::as_str), Some("szkolenia"));
    for merged in ["szkoleń", "szkoleniu"] {
        assert!(!terms.contains(&merged.to_string()), "{merged}");
    }
    assert_eq!(
        terms
            .iter()
            .filter(|term| term.starts_with("szkol"))
            .count(),
        1
    );
}

#[test]
fn semantic_language_prefers_the_declared_language_and_infers_otherwise() {
    let polish = Html::parse_document(
        r#"<html><body><main><p>Szkolenie jest dla zespołów, które się uczą. Szkolenia oraz konsultacje dla firm, które mogą rosnąć.</p></main></body></html>"#,
    );
    assert_eq!(semantic_term_language(&polish, None).as_deref(), Some("pl"));
    assert_eq!(
        semantic_term_language(&polish, Some("EN-gb")).as_deref(),
        Some("en")
    );
    let unknown =
        Html::parse_document(r#"<html><body><main><p>Espresso.</p></main></body></html>"#);
    assert_eq!(semantic_term_language(&unknown, None), None);

    let language = semantic_term_language(&polish, None);
    let terms = extract_semantic_terms(&polish, language.as_deref());
    assert_eq!(
        terms
            .iter()
            .filter(|term| term.starts_with("szkol"))
            .count(),
        1
    );
}

#[test]
fn semantic_extraction_keeps_uppercase_two_letter_acronyms() {
    let document = Html::parse_document(
        r#"<html lang="pl"><body><main><p>AI w sprzedaży B2B. Po co AI? To HR i PR, a nie ai czy it.</p></main></body></html>"#,
    );
    let terms = extract_semantic_terms(&document, Some("pl"));
    for kept in ["ai", "hr", "pr"] {
        assert!(terms.contains(&kept.to_string()), "{kept}");
    }
    for excluded in ["to", "it", "po", "co", "w"] {
        assert!(!terms.contains(&excluded.to_string()), "{excluded}");
    }
}
