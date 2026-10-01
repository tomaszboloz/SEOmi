use super::markup::{aria_hidden_value, semantic_style_hides};
use crate::models::audit_data::{
    AccessibilityAudit, AccessibilityElementEvidence, AccessibilityFinding, AccessibilityLandmark,
};
use scraper::{ElementRef, Html, Selector};
use std::collections::HashSet;

pub(super) fn extract_accessibility(document: &Html, html_str: &str) -> AccessibilityAudit {
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

    let all_elements_selector = Selector::parse("*").expect("static universal selector is valid");
    let controls_selector =
        Selector::parse("input, select, textarea").expect("static controls selector is valid");
    let mut landmark_counts = std::collections::BTreeMap::new();
    let mut aria_attribute_count = 0;
    let mut ids = HashSet::new();
    let mut nonempty_id_names = HashSet::new();
    let mut duplicate_id_values = HashSet::new();
    let mut duplicate_id_count = 0;
    let mut duplicate_ids = Vec::new();
    let mut unresolved_aria_reference_count = 0;
    let mut unresolved_aria_references = Vec::new();
    for element in document.select(&all_elements_selector) {
        if let Some(id) = element
            .value()
            .attr("id")
            .map(str::trim)
            .filter(|id| !id.is_empty())
        {
            if element
                .text()
                .any(|text| text.chars().any(|character| !character.is_whitespace()))
                || element
                    .value()
                    .attr("aria-label")
                    .is_some_and(|value| !value.trim().is_empty())
                || element
                    .value()
                    .attr("title")
                    .is_some_and(|value| !value.trim().is_empty())
            {
                nonempty_id_names.insert(id.to_string());
            }
            if !ids.insert(id.to_string()) {
                duplicate_id_count += 1;
                duplicate_id_values.insert(id.to_string());
                if duplicate_ids.len() < 10 && !duplicate_ids.iter().any(|existing| existing == id)
                {
                    duplicate_ids.push(id.to_string());
                }
            }
        }
    }
    for element in document.select(&all_elements_selector) {
        aria_attribute_count += element
            .value()
            .attrs()
            .filter(|(name, _)| name.to_ascii_lowercase().starts_with("aria-"))
            .count();
        for attribute in [
            "aria-labelledby",
            "aria-describedby",
            "aria-controls",
            "aria-owns",
            "aria-flowto",
            "aria-details",
            "aria-errormessage",
        ] {
            if let Some(value) = element.value().attr(attribute) {
                for reference in value.split_ascii_whitespace() {
                    if !reference.is_empty() && !ids.contains(reference) {
                        unresolved_aria_reference_count += 1;
                        if unresolved_aria_references.len() < 10 {
                            unresolved_aria_references.push((attribute, reference.to_string()));
                        }
                    }
                }
            }
        }
        let tag = element.value().name();
        let landmark = match tag {
            "main" => Some("main".to_string()),
            "nav" => Some("navigation".to_string()),
            "aside" => Some("complementary".to_string()),
            "footer" => Some("contentinfo".to_string()),
            "header" => Some("banner".to_string()),
            _ => match element
                .value()
                .attr("role")
                .map(|value| value.trim().to_ascii_lowercase())
            {
                Some(role)
                    if matches!(
                        role.as_str(),
                        "main"
                            | "navigation"
                            | "complementary"
                            | "contentinfo"
                            | "banner"
                            | "search"
                            | "region"
                    ) =>
                {
                    Some(role)
                }
                _ => None,
            },
        };
        if let Some(landmark) = landmark {
            *landmark_counts.entry(landmark).or_insert(0) += 1;
        }
    }

    let mut findings = Vec::new();
    let mut add_finding =
        |code: &str, severity: &str, message: String, evidence: String, recommendation: &str| {
            if findings.len() < 500 {
                findings.push(AccessibilityFinding {
                    code: code.to_string(),
                    severity: severity.to_string(),
                    message,
                    evidence,
                    recommendation: recommendation.to_string(),
                    elements: Vec::new(),
                });
            }
        };
    match document_language.as_deref() {
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

    let mut form_control_count = 0;
    let mut unlabeled_form_control_count = 0;
    let mut hidden_form_control_count = 0;
    let mut hidden_form_controls = Vec::new();
    let mut anti_spam_text_control_count = 0;
    let mut anti_spam_text_controls = Vec::new();
    let mut anti_spam_non_text_control_count = 0;
    let mut anti_spam_non_text_controls = Vec::new();
    let mut unlabeled_form_controls = Vec::new();
    for (control_index, control) in document.select(&controls_selector).enumerate() {
        let input_type = control
            .value()
            .attr("type")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        if input_type == "hidden" {
            hidden_form_control_count += 1;
            if hidden_form_controls.len() < 50 {
                hidden_form_controls.push(accessibility_control_evidence(
                    &control,
                    control_index + 1,
                    html_str,
                ));
            }
            if is_explicitly_marked_anti_spam_control(&control)
                || is_hidden_conventional_anti_spam_field(&control)
            {
                anti_spam_non_text_control_count += 1;
                if anti_spam_non_text_controls.len() < 50 {
                    anti_spam_non_text_controls.push(accessibility_control_evidence(
                        &control,
                        control_index + 1,
                        html_str,
                    ));
                }
            }
            continue;
        }
        if input_type == "text" && is_marked_anti_spam_text_control(&control) {
            anti_spam_text_control_count += 1;
            if anti_spam_text_controls.len() < 50 {
                anti_spam_text_controls.push(accessibility_control_evidence(
                    &control,
                    control_index + 1,
                    html_str,
                ));
            }
            continue;
        }
        form_control_count += 1;
        let has_accessible_name = control
            .value()
            .attr("aria-label")
            .is_some_and(|value| !value.trim().is_empty())
            || control
                .value()
                .attr("aria-labelledby")
                .is_some_and(|value| {
                    value
                        .split_ascii_whitespace()
                        .any(|reference| nonempty_id_names.contains(reference))
                })
            || control
                .value()
                .attr("id")
                .is_some_and(|id| labels_for.contains(id))
            || control
                .ancestors()
                .filter_map(ElementRef::wrap)
                .any(|ancestor| {
                    ancestor.value().name() == "label"
                        && ancestor
                            .text()
                            .any(|text| text.chars().any(|character| !character.is_whitespace()))
                });
        if !has_accessible_name {
            unlabeled_form_control_count += 1;
            if unlabeled_form_controls.len() < 50 {
                unlabeled_form_controls.push(accessibility_control_evidence(
                    &control,
                    control_index + 1,
                    html_str,
                ));
            }
        }
    }

    if anti_spam_non_text_control_count > 0 {
        add_finding(
            "accessibility-antispam-control-not-text",
            "warning",
            format!(
                "Wykryto {} jawnie oznaczone{} pole antyspamowe z typem innym niż text.",
                anti_spam_non_text_control_count,
                if anti_spam_non_text_control_count == 1 {
                    ""
                } else {
                    " pola"
                }
            ),
            "Pola są wskazane poniżej; ich wartości nie są zapisywane.".into(),
            "Jeśli to pułapka honeypot, zachowaj input type=\"text\" i ukryj go wizualnie poza widokiem użytkownika. Nie zmieniaj go na type=\"hidden\", ponieważ boty często pomijają pola tego typu.",
        );
    }

    if form_control_count > 0 && unlabeled_form_control_count > 0 {
        add_finding(
            "accessibility-form-controls-unlabeled",
            "warning",
            format!("{unlabeled_form_control_count} z {form_control_count} kontrolek formularza w pobranym HTML nie ma wykrytej etykiety programowej."),
            format!("Nieopisane pola: {unlabeled_form_control_count}/{form_control_count}; szczegóły elementów podano poniżej."),
            "Powiąż każde pole z label[for], etykietą obejmującą kontrolkę, aria-label lub aria-labelledby.",
        );
    }

    if duplicate_id_count > 0 {
        add_finding(
            "accessibility-duplicate-id",
            "warning",
            format!("Wykryto {duplicate_id_count} powtórzonych identyfikatorów HTML."),
            format!("Przykłady: {}", duplicate_ids.join(", ")),
            "Nadaj elementom unikalne identyfikatory; etykiety i referencje ARIA zależą od jednoznacznych ID.",
        );
    }
    if unresolved_aria_reference_count > 0 {
        let examples = unresolved_aria_references
            .iter()
            .take(10)
            .map(|(attribute, reference)| format!("{attribute}={reference}"))
            .collect::<Vec<_>>()
            .join(", ");
        add_finding(
            "accessibility-aria-reference-unresolved",
            "warning",
            format!("Wykryto {unresolved_aria_reference_count} referencji ARIA do nieistniejących identyfikatorów."),
            examples,
            "Upewnij się, że każdy token atrybutu referencyjnego ARIA wskazuje istniejący element o unikalnym ID.",
        );
    }

    const DUPLICATE_ID_SELECTOR: &str = "[id]";
    const ARIA_REFERENCE_SELECTOR: &str = "[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [aria-flowto], [aria-details], [aria-errormessage]";
    let duplicate_id_selector =
        Selector::parse(DUPLICATE_ID_SELECTOR).expect("static duplicate-id selector is valid");
    let duplicate_id_elements = document
        .select(&duplicate_id_selector)
        .enumerate()
        .filter_map(|(index, element)| {
            element
                .value()
                .attr("id")
                .map(str::trim)
                .filter(|id| duplicate_id_values.contains(*id))
                .map(|_| {
                    accessibility_element_evidence(
                        &element,
                        index + 1,
                        DUPLICATE_ID_SELECTOR,
                        html_str,
                    )
                })
        })
        .take(50)
        .collect::<Vec<_>>();

    let aria_reference_selector =
        Selector::parse(ARIA_REFERENCE_SELECTOR).expect("static ARIA reference selector is valid");
    let aria_reference_attributes = [
        "aria-labelledby",
        "aria-describedby",
        "aria-controls",
        "aria-owns",
        "aria-flowto",
        "aria-details",
        "aria-errormessage",
    ];
    let unresolved_aria_elements = document
        .select(&aria_reference_selector)
        .enumerate()
        .filter_map(|(index, element)| {
            let has_unresolved_reference = aria_reference_attributes.iter().any(|attribute| {
                element.value().attr(attribute).is_some_and(|value| {
                    value
                        .split_ascii_whitespace()
                        .any(|reference| !reference.is_empty() && !ids.contains(reference))
                })
            });
            has_unresolved_reference.then(|| {
                accessibility_element_evidence(
                    &element,
                    index + 1,
                    ARIA_REFERENCE_SELECTOR,
                    html_str,
                )
            })
        })
        .take(50)
        .collect::<Vec<_>>();

    const NAMED_ELEMENTS_SELECTOR: &str = "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";
    let named_elements_selector =
        Selector::parse(NAMED_ELEMENTS_SELECTOR).expect("static named-element selector is valid");
    const FOCUSABLE_ARIA_HIDDEN_SELECTOR: &str = "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";
    let focusable_aria_hidden_selector = Selector::parse(FOCUSABLE_ARIA_HIDDEN_SELECTOR)
        .expect("static aria-hidden focus selector is valid");
    let mut aria_hidden_focusable_count = 0;
    let mut aria_hidden_focusable_elements = Vec::new();
    for (focusable_index, element) in document.select(&focusable_aria_hidden_selector).enumerate() {
        let value = element.value();
        let input_type = value
            .attr("type")
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        if input_type == "hidden"
            || is_marked_anti_spam_text_control(&element)
            || value.attr("disabled").is_some()
            || aria_hidden_value(value.attr("aria-disabled"))
            || focusability_blocked_by_markup(&element)
        {
            continue;
        }
        let hidden_by_aria = aria_hidden_value(value.attr("aria-hidden"))
            || element
                .ancestors()
                .filter_map(ElementRef::wrap)
                .any(|ancestor| aria_hidden_value(ancestor.value().attr("aria-hidden")));
        if !hidden_by_aria {
            continue;
        }
        aria_hidden_focusable_count += 1;
        if aria_hidden_focusable_elements.len() < 50 {
            aria_hidden_focusable_elements.push(accessibility_element_evidence(
                &element,
                focusable_index + 1,
                FOCUSABLE_ARIA_HIDDEN_SELECTOR,
                html_str,
            ));
        }
    }
    if aria_hidden_focusable_count > 0 {
        add_finding(
            "accessibility-focusable-aria-hidden",
            "warning",
            format!(
                "Wykryto {aria_hidden_focusable_count} elementów możliwych do fokusu w aria-hidden=true."
            ),
            format!(
                "Elementy interaktywne ukryte przed drzewem dostępności: {aria_hidden_focusable_count}."
            ),
            "Nie ukrywaj elementu możliwego do fokusu przez aria-hidden=true; usuń go z kolejności fokusu albo udostępnij go w drzewie dostępności.",
        );
    }
    let nonempty_alt_image_selector =
        Selector::parse("img[alt]:not([alt=''])").expect("static image selector is valid");
    let mut unnamed_interactive_count = 0;
    let mut unnamed_interactive = Vec::new();
    let mut unnamed_interactive_elements = Vec::new();
    for (interactive_index, element) in document.select(&named_elements_selector).enumerate() {
        let value = element.value();
        let labelled_by = value.attr("aria-labelledby").is_some_and(|refs| {
            refs.split_ascii_whitespace()
                .any(|id| nonempty_id_names.contains(id))
        });
        let has_name = value
            .attr("aria-label")
            .is_some_and(|name| !name.trim().is_empty())
            || labelled_by
            || value
                .attr("title")
                .is_some_and(|title| !title.trim().is_empty())
            || value
                .attr("value")
                .is_some_and(|text| !text.trim().is_empty())
            || element
                .text()
                .collect::<String>()
                .chars()
                .any(|character| !character.is_whitespace())
            || element
                .select(&nonempty_alt_image_selector)
                .next()
                .is_some();
        if !has_name {
            unnamed_interactive_count += 1;
            if unnamed_interactive_elements.len() < 50 {
                unnamed_interactive_elements.push(accessibility_element_evidence(
                    &element,
                    interactive_index + 1,
                    NAMED_ELEMENTS_SELECTOR,
                    html_str,
                ));
            }
            let selector_hint = value
                .attr("id")
                .map(|id| format!("#{}", id))
                .or_else(|| value.attr("href").map(|href| format!("a[href={href}]")))
                .unwrap_or_else(|| value.name().to_string());
            if unnamed_interactive.len() < 10 {
                unnamed_interactive.push(selector_hint);
            }
        }
    }
    if unnamed_interactive_count > 0 {
        add_finding(
            "accessibility-interactive-name-missing",
            "warning",
            format!("Wykryto {unnamed_interactive_count} linków lub kontrolek bez wykrytej nazwy dostępnej."),
            format!("Przykłady: {}", unnamed_interactive.join(", ")),
            "Nadaj linkom i kontrolkom zrozumiałą nazwę przez widoczny tekst, opisowy alt obrazu albo etykietę ARIA.",
        );
    }

    let images_selector =
        Selector::parse("img:not([alt])").expect("static image selector is valid");
    let mut images_without_alt_elements = Vec::new();
    for (image_index, element) in document.select(&images_selector).enumerate() {
        if images_without_alt_elements.len() < 50 {
            images_without_alt_elements.push(accessibility_element_evidence(
                &element,
                image_index + 1,
                "img:not([alt])",
                html_str,
            ));
        }
    }
    let images_without_alt = document.select(&images_selector).count();
    if images_without_alt > 0 {
        add_finding(
            "accessibility-image-alt-missing",
            "warning",
            format!("{images_without_alt} obrazów nie ma atrybutu alt."),
            format!("Liczba img bez alt: {images_without_alt}"),
            "Dodaj alt opisujący informację obrazu; dla obrazów czysto dekoracyjnych użyj alt=\"\".",
        );
    }

    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-form-controls-unlabeled")
    {
        finding.elements = unlabeled_form_controls;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-antispam-control-not-text")
    {
        finding.elements = anti_spam_non_text_controls;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-interactive-name-missing")
    {
        finding.elements = unnamed_interactive_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-focusable-aria-hidden")
    {
        finding.elements = aria_hidden_focusable_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-image-alt-missing")
    {
        finding.elements = images_without_alt_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-duplicate-id")
    {
        finding.elements = duplicate_id_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-aria-reference-unresolved")
    {
        finding.elements = unresolved_aria_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-document-language-invalid")
    {
        finding.elements = html_elements;
    }
    if let Some(finding) = findings
        .iter_mut()
        .find(|finding| finding.code == "accessibility-multiple-main-landmarks")
    {
        finding.elements = main_landmark_elements;
    }

    AccessibilityAudit {
        document_language,
        landmarks: landmark_counts
            .into_iter()
            .map(|(name, count)| AccessibilityLandmark { name, count })
            .collect(),
        aria_attribute_count,
        form_control_count,
        unlabeled_form_control_count,
        hidden_form_control_count,
        hidden_form_controls,
        anti_spam_text_control_count,
        anti_spam_text_controls,
        findings,
        manual_review_items: vec![
            "Kontrast tekstu i elementów interfejsu wymaga pomiaru w wyrenderowanych stanach strony.".to_string(),
            "Działanie klawiaturą, widoczność fokusu, pułapki fokusu i kolejność tabulacji wymagają testu interaktywnego.".to_string(),
            "Poprawność nazw, ról i stanów ARIA wymaga weryfikacji drzewa dostępności w przeglądarce czytnikiem ekranu.".to_string(),
        ],
    }
}

pub(super) fn form_control_source_offset(source: &str, dom_position: usize) -> Option<usize> {
    if dom_position == 0 {
        return None;
    }
    let mut search_from = 0usize;
    let mut position = 0usize;
    while let Some(relative) = source.get(search_from..)?.find('<') {
        let tag_start = search_from + relative;
        let after_opening = tag_start + 1;
        if source[after_opening..].starts_with("!--") {
            search_from = source[after_opening..]
                .find("-->")
                .map_or(source.len(), |offset| after_opening + offset + 3);
            continue;
        }
        let next = source[after_opening..].chars().next()?;
        if matches!(next, '/' | '!' | '?') {
            search_from = after_opening;
            continue;
        }
        let name_end = source[after_opening..]
            .char_indices()
            .find(|(_, character)| {
                character.is_ascii_whitespace() || matches!(character, '>' | '/')
            })
            .map(|(offset, _)| after_opening + offset)
            .unwrap_or(source.len());
        let name = source.get(after_opening..name_end)?.to_ascii_lowercase();
        if matches!(name.as_str(), "script" | "style") {
            let closing_marker = format!("</{name}");
            let source_lower = source[after_opening..].to_ascii_lowercase();
            search_from = source_lower
                .find(&closing_marker)
                .map_or(source.len(), |offset| after_opening + offset);
            continue;
        }
        if matches!(name.as_str(), "input" | "select" | "textarea") {
            position += 1;
            if position == dom_position {
                return Some(tag_start);
            }
        }
        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_opening..].char_indices() {
            if let Some(active) = quote {
                if character == active {
                    quote = None;
                }
            } else if matches!(character, '\'' | '"') {
                quote = Some(character);
            } else if character == '>' {
                tag_end = Some(after_opening + offset);
                break;
            }
        }
        search_from = tag_end.map_or(source.len(), |offset| offset + 1);
    }
    None
}

pub(super) fn source_line_column(source: &str, offset: usize) -> (Option<usize>, Option<usize>) {
    let offset = offset.min(source.len());
    if !source.is_char_boundary(offset) {
        return (None, None);
    }
    let prefix = &source[..offset];
    let line_start = prefix.rfind('\n').map_or(0, |index| index + 1);
    (
        Some(prefix.bytes().filter(|byte| *byte == b'\n').count() + 1),
        Some(source[line_start..offset].chars().count() + 1),
    )
}

/// Finds the source offset of an element in the same order as a browser's
/// `querySelectorAll` result for the small, deterministic selectors used by
/// the accessibility findings. The parser intentionally ignores comments and
/// script/style text so a literal `<img>` or `<button>` in JavaScript cannot
/// shift the reported location.
pub(super) fn element_source_offset(
    source: &str,
    dom_position: usize,
    element: &ElementRef<'_>,
    selector: &str,
) -> Option<usize> {
    if dom_position == 0 {
        return None;
    }

    let expected_name = element.value().name();
    let mut search_from = 0usize;
    let mut position = 0usize;
    while let Some(relative) = source.get(search_from..)?.find('<') {
        let tag_start = search_from + relative;
        let after_opening = tag_start + 1;
        if source[after_opening..].starts_with("!--") {
            search_from = source[after_opening..]
                .find("-->")
                .map_or(source.len(), |offset| after_opening + offset + 3);
            continue;
        }
        let next = source[after_opening..].chars().next()?;
        if matches!(next, '/' | '!' | '?') {
            search_from = after_opening;
            continue;
        }

        let name_end = source[after_opening..]
            .char_indices()
            .find(|(_, character)| {
                character.is_ascii_whitespace() || matches!(character, '>' | '/')
            })
            .map(|(offset, _)| after_opening + offset)
            .unwrap_or(source.len());
        let name = source.get(after_opening..name_end)?.to_ascii_lowercase();

        let mut quote = None;
        let mut tag_end = None;
        for (offset, character) in source[after_opening..].char_indices() {
            if let Some(active) = quote {
                if character == active {
                    quote = None;
                }
            } else if matches!(character, '\'' | '"') {
                quote = Some(character);
            } else if character == '>' {
                tag_end = Some(after_opening + offset);
                break;
            }
        }
        let Some(tag_end) = tag_end else {
            break;
        };

        if name == "script" || name == "style" {
            let closing_marker = format!("</{name}");
            let source_lower = source[after_opening..].to_ascii_lowercase();
            search_from = source_lower
                .find(&closing_marker)
                .map_or(source.len(), |offset| after_opening + offset);
            continue;
        }

        if name == expected_name
            && source_tag_matches_selector(&source[tag_start..=tag_end], expected_name, selector)
        {
            position += 1;
            if position == dom_position {
                return Some(tag_start);
            }
        }
        search_from = tag_end + 1;
    }
    None
}

pub(super) fn source_tag_matches_selector(tag: &str, element_name: &str, selector: &str) -> bool {
    let element_name = element_name.to_ascii_lowercase();
    match selector {
        "img:not([alt])" => element_name == "img" && source_attribute_value(tag, "alt").is_none(),
        "[id]" => source_attribute_value(tag, "id").is_some(),
        "html" => element_name == "html",
        "main, [role='main']" => {
            element_name == "main"
                || source_attribute_value(tag, "role")
                    .is_some_and(|value| value.trim().eq_ignore_ascii_case("main"))
        }
        "[aria-labelledby], [aria-describedby], [aria-controls], [aria-owns], [aria-flowto], [aria-details], [aria-errormessage]" => [
            "aria-labelledby",
            "aria-describedby",
            "aria-controls",
            "aria-owns",
            "aria-flowto",
            "aria-details",
            "aria-errormessage",
        ]
        .iter()
        .any(|attribute| source_attribute_value(tag, attribute).is_some()),
        "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']" => {
            (element_name == "a" && source_attribute_value(tag, "href").is_some())
                || element_name == "button"
                || (element_name == "input"
                    && source_attribute_value(tag, "type").is_some_and(|value| {
                        matches!(
                            value.trim().to_ascii_lowercase().as_str(),
                            "button" | "submit" | "reset"
                        )
                    }))
                || source_attribute_value(tag, "role").is_some_and(|value| {
                    matches!(
                        value.trim().to_ascii_lowercase().as_str(),
                        "button" | "link" | "checkbox" | "radio" | "switch" | "tab" | "menuitem"
                    )
                })
        }
        "a[href], button, input:not([type='hidden']), select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']" => {
            (element_name == "a" && source_attribute_value(tag, "href").is_some())
                || element_name == "button"
                || (element_name == "input"
                    && source_attribute_value(tag, "type").map_or(true, |value| {
                        !value.trim().eq_ignore_ascii_case("hidden")
                    }))
                || matches!(element_name.as_str(), "select" | "textarea")
                || (source_attribute_value(tag, "tabindex")
                    .is_some_and(|value| value.trim() != "-1"))
                || source_attribute_value(tag, "contenteditable")
                    .is_some_and(|value| value.trim().eq_ignore_ascii_case("true"))
                || source_attribute_value(tag, "role").is_some_and(|value| {
                    matches!(
                        value.trim().to_ascii_lowercase().as_str(),
                        "button" | "link" | "checkbox" | "radio" | "switch" | "tab" | "menuitem"
                    )
                })
        }
        _ => false,
    }
}

/// Reads one HTML attribute from a single opening tag. It accepts quoted and
/// unquoted values and boolean attributes, while never inspecting text after
/// the closing `>`.
pub(super) fn source_attribute_value(tag: &str, requested: &str) -> Option<String> {
    let bytes = tag.as_bytes();
    let mut cursor = 1usize;
    while cursor < bytes.len() {
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }
        if cursor >= bytes.len() || matches!(bytes[cursor], b'>' | b'/') {
            break;
        }
        let name_start = cursor;
        while cursor < bytes.len()
            && !bytes[cursor].is_ascii_whitespace()
            && !matches!(bytes[cursor], b'=' | b'>' | b'/')
        {
            cursor += 1;
        }
        let name = tag.get(name_start..cursor)?;
        while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
            cursor += 1;
        }

        let value = if cursor < bytes.len() && bytes[cursor] == b'=' {
            cursor += 1;
            while cursor < bytes.len() && bytes[cursor].is_ascii_whitespace() {
                cursor += 1;
            }
            if cursor >= bytes.len() {
                String::new()
            } else if matches!(bytes[cursor], b'\'' | b'"') {
                let quote = bytes[cursor];
                cursor += 1;
                let value_start = cursor;
                while cursor < bytes.len() && bytes[cursor] != quote {
                    cursor += 1;
                }
                let value = tag.get(value_start..cursor)?.to_string();
                if cursor < bytes.len() {
                    cursor += 1;
                }
                value
            } else {
                let value_start = cursor;
                while cursor < bytes.len()
                    && !bytes[cursor].is_ascii_whitespace()
                    && bytes[cursor] != b'>'
                {
                    cursor += 1;
                }
                tag.get(value_start..cursor)?.to_string()
            }
        } else {
            String::new()
        };

        if name.eq_ignore_ascii_case(requested) {
            return Some(value);
        }
    }
    None
}

pub(super) fn accessibility_element_evidence(
    element: &ElementRef<'_>,
    dom_position: usize,
    selector: &str,
    source: &str,
) -> AccessibilityElementEvidence {
    let (line, column) = element_source_offset(source, dom_position, element, selector)
        .map_or((None, None), |offset| source_line_column(source, offset));
    AccessibilityElementEvidence {
        dom_position,
        dom_query: accessibility_dom_query(selector, dom_position - 1),
        html_snippet: accessibility_element_snippet(element),
        line,
        column,
    }
}

pub(super) fn accessibility_dom_query(selector: &str, index: usize) -> String {
    if selector.contains('\'') {
        format!(
            "document.querySelectorAll(\"{}\")[{index}]",
            selector.replace('"', "\\\"")
        )
    } else {
        format!("document.querySelectorAll('{selector}')[{index}]")
    }
}

pub(super) fn accessibility_control_evidence(
    control: &ElementRef<'_>,
    dom_position: usize,
    source: &str,
) -> AccessibilityElementEvidence {
    let selector_index = dom_position - 1;
    let (line, column) = form_control_source_offset(source, dom_position)
        .map_or((None, None), |offset| source_line_column(source, offset));
    AccessibilityElementEvidence {
        dom_position,
        dom_query: format!(
            "document.querySelectorAll('input, select, textarea')[{selector_index}]"
        ),
        html_snippet: accessibility_control_snippet(control),
        line,
        column,
    }
}

pub(super) fn is_marked_anti_spam_text_control(control: &ElementRef<'_>) -> bool {
    is_explicitly_marked_anti_spam_control(control)
        || is_hidden_conventional_anti_spam_field(control)
}

pub(super) fn is_explicitly_marked_anti_spam_control(control: &ElementRef<'_>) -> bool {
    let marker_attributes = ["id", "name", "class"]
        .iter()
        .filter_map(|attribute| control.value().attr(attribute))
        .collect::<Vec<_>>();
    let marker = marker_attributes.iter().any(|value| {
        let tokens = value
            .split(|character: char| !character.is_ascii_alphanumeric())
            .map(str::to_ascii_lowercase)
            .collect::<Vec<_>>();
        tokens
            .iter()
            .any(|token| matches!(token.as_str(), "honeypot" | "honeytrap" | "spamtrap"))
            || value
                .chars()
                .filter(char::is_ascii_alphanumeric)
                .collect::<String>()
                .to_ascii_lowercase()
                .contains("botfield")
    });

    if marker {
        return true;
    }

    false
}

/// An element inside `aria-hidden` is only actionable when it is otherwise
/// focusable. Boolean `hidden`/`inert` and static visibility declarations make
/// the browser remove it from keyboard focus, so they are not accessibility
/// violations of the `aria-hidden` focus rule themselves.
pub(super) fn focusability_blocked_by_markup(element: &ElementRef<'_>) -> bool {
    let blocked = |candidate: ElementRef<'_>| {
        let value = candidate.value();
        value.attr("hidden").is_some()
            || value.attr("inert").is_some()
            || value.attr("style").is_some_and(semantic_style_hides)
    };
    blocked(*element)
        || element
            .ancestors()
            .filter_map(ElementRef::wrap)
            .any(blocked)
}

pub(super) fn style_hides_control(value: &str) -> bool {
    value.split(';').any(|declaration| {
        let Some((property, raw_value)) = declaration.split_once(':') else {
            return false;
        };
        let property = property.trim().to_ascii_lowercase();
        let value = raw_value
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .trim_end_matches(';')
            .to_ascii_lowercase();
        let value = value.strip_suffix("!important").unwrap_or(&value);
        matches!(
            (property.as_str(), value),
            ("display", "none")
                | ("visibility", "hidden")
                | ("content-visibility", "hidden")
                | ("opacity", "0")
        ) || (property == "left" && value.starts_with('-'))
    })
}

pub(super) fn is_hidden_conventional_anti_spam_field(control: &ElementRef<'_>) -> bool {
    let hidden_by_markup = |element: ElementRef<'_>| {
        let value = element.value();
        value.attr("hidden").is_some()
            || value.attr("inert").is_some()
            || aria_hidden_value(value.attr("aria-hidden"))
            || value.attr("style").is_some_and(style_hides_control)
    };
    let is_hidden = control
        .value()
        .attr("type")
        .is_some_and(|input_type| input_type.trim().eq_ignore_ascii_case("hidden"))
        || control
            .value()
            .attr("tabindex")
            .is_some_and(|value| value.trim() == "-1")
        || hidden_by_markup(*control)
        || control
            .ancestors()
            .filter_map(ElementRef::wrap)
            .any(hidden_by_markup);
    let conventional_honeypot_name = ["id", "name"]
        .iter()
        .filter_map(|attribute| control.value().attr(attribute))
        .any(|value| {
            let normalized = value
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .collect::<String>()
                .to_ascii_lowercase();
            matches!(
                normalized.as_str(),
                "website"
                    | "url"
                    | "websiteurl"
                    | "companywebsite"
                    | "companyurl"
                    | "yourwebsite"
                    | "homepage"
                    | "homepageurl"
            )
        });
    is_hidden && conventional_honeypot_name
}

pub(super) fn accessibility_control_snippet(control: &ElementRef<'_>) -> String {
    accessibility_element_snippet(control)
}

pub(super) fn accessibility_element_snippet(control: &ElementRef<'_>) -> String {
    const SAFE_ATTRIBUTES: &[&str] = &[
        "id",
        "lang",
        "type",
        "name",
        "autocomplete",
        "placeholder",
        "class",
        "href",
        "role",
        "alt",
        "src",
        "loading",
        "width",
        "height",
        "title",
        "aria-label",
        "aria-labelledby",
        "aria-describedby",
        "aria-controls",
        "aria-owns",
        "aria-flowto",
        "aria-details",
        "aria-errormessage",
        "aria-hidden",
        "aria-disabled",
        "tabindex",
        "contenteditable",
    ];
    const BOOLEAN_ATTRIBUTES: &[&str] =
        &["required", "disabled", "readonly", "multiple", "checked"];

    let mut snippet = format!("<{}", control.value().name());
    for (name, value) in control.value().attrs() {
        if SAFE_ATTRIBUTES.contains(&name) && !value.is_empty() {
            let safe_value = if matches!(name, "href" | "src") {
                value.split(['?', '#']).next().unwrap_or(value)
            } else {
                value
            };
            let escaped = safe_value
                .replace('&', "&amp;")
                .replace('"', "&quot;")
                .replace('<', "&lt;")
                .replace('>', "&gt;");
            snippet.push_str(&format!(" {name}=\"{escaped}\""));
        } else if BOOLEAN_ATTRIBUTES.contains(&name) {
            snippet.push_str(&format!(" {name}"));
        }
    }
    snippet.push('>');

    let mut bounded = snippet.chars().take(320).collect::<String>();
    if snippet.chars().count() > 320 {
        bounded.push('…');
    }
    bounded
}

pub(super) fn is_structurally_valid_language_tag(value: &str) -> bool {
    let mut parts = value.split('-');
    let Some(primary) = parts.next() else {
        return false;
    };
    if primary.is_empty()
        || primary.len() > 8
        || !primary.bytes().all(|byte| byte.is_ascii_alphabetic())
    {
        return false;
    }
    if primary.len() == 1
        && !primary.eq_ignore_ascii_case("x")
        && !primary.eq_ignore_ascii_case("i")
    {
        return false;
    }
    let subtags = parts.collect::<Vec<_>>();
    if primary.len() == 1 && subtags.is_empty() {
        return false;
    }
    subtags.iter().all(|part| {
        !part.is_empty() && part.len() <= 8 && part.bytes().all(|byte| byte.is_ascii_alphanumeric())
    })
}
