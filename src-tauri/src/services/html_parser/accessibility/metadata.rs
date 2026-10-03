use super::*;

pub(in crate::services::html_parser) fn document_metadata(
    document: &Html,
) -> (Option<String>, HashSet<&str>) {
    let html_selector = Selector::parse("html").expect("static html selector is valid");
    let document_language = document
        .select(&html_selector)
        .next()
        .and_then(|element| element.value().attr("lang"))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    let labels_selector = Selector::parse("label[for]").expect("static label selector is valid");
    let labels_for = document
        .select(&labels_selector)
        .filter_map(|label| {
            let id = label.value().attr("for")?.trim();
            let has_text = label
                .text()
                .any(|text| text.chars().any(|character| !character.is_whitespace()));
            (has_text && !id.is_empty()).then_some(id)
        })
        .collect::<HashSet<_>>();
    (document_language, labels_for)
}

pub(in crate::services::html_parser) fn document_findings(
    document_language: Option<&str>,
    landmark_counts: &std::collections::BTreeMap<String, usize>,
    add_finding: &mut impl FnMut(&str, &str, String, String, &str),
) {
    match document_language {
        None => add_finding(
            "accessibility-document-language-missing",
            "warning",
            "Dokument nie deklaruje języka na elemencie html.".into(),
            "Brak niepustego atrybutu html[lang].".into(),
            "Ustaw poprawny strukturalnie atrybut lang na elemencie html.",
        ),
        Some(language) if !is_structurally_valid_language_tag(language) => add_finding(
            "accessibility-document-language-invalid",
            "warning",
            "Wartość html[lang] ma niepoprawny kształt tagu językowego.".into(),
            format!("lang={language}"),
            "Użyj strukturalnie poprawnego tagu BCP 47; ten skan nie sprawdza aktualnego rejestru IANA.",
        ),
        _ => {}
    }
    let main_count = landmark_counts.get("main").copied().unwrap_or_default();
    if main_count == 0 {
        add_finding(
            "accessibility-main-landmark-missing",
            "info",
            "Nie wykryto głównego landmarku strony.".into(),
            "Brak elementu main lub role=main.".into(),
            "Oznacz główną treść pojedynczym elementem main albo role=main.",
        );
    } else if main_count > 1 {
        add_finding(
            "accessibility-multiple-main-landmarks",
            "warning",
            format!("Wykryto {main_count} główne landmarki."),
            format!("Liczba main / role=main: {main_count}"),
            "Pozostaw jeden główny landmark dla podstawowej treści dokumentu.",
        );
    }
}

pub(in crate::services::html_parser) fn document_elements(
    document: &Html,
    html_str: &str,
) -> (
    Vec<AccessibilityElementEvidence>,
    Vec<AccessibilityElementEvidence>,
) {
    const HTML_SELECTOR: &str = "html";
    const MAIN_LANDMARK_SELECTOR: &str = "main, [role='main']";
    let html_selector_for_evidence =
        Selector::parse(HTML_SELECTOR).expect("static html evidence selector is valid");
    let html_elements = document
        .select(&html_selector_for_evidence)
        .enumerate()
        .take(50)
        .map(|(index, element)| {
            accessibility_element_evidence(&element, index + 1, HTML_SELECTOR, html_str)
        })
        .collect::<Vec<_>>();
    let main_landmark_selector = Selector::parse(MAIN_LANDMARK_SELECTOR)
        .expect("static main landmark evidence selector is valid");
    let main_landmark_elements = document
        .select(&main_landmark_selector)
        .enumerate()
        .take(50)
        .map(|(index, element)| {
            accessibility_element_evidence(&element, index + 1, MAIN_LANDMARK_SELECTOR, html_str)
        })
        .collect::<Vec<_>>();
    (html_elements, main_landmark_elements)
}
