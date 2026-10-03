use super::*;

pub(in crate::services::html_parser) fn control_findings(
    c: &ControlInventory,
    add_finding: &mut impl FnMut(&str, &str, String, String, &str),
) {
    let anti_spam_non_text_control_count = c.anti_spam_non_text_control_count;
    let form_control_count = c.form_control_count;
    let unlabeled_form_control_count = c.unlabeled_form_control_count;
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
}

pub(in crate::services::html_parser) fn identity_findings(
    i: &IdentityInventory,
    add_finding: &mut impl FnMut(&str, &str, String, String, &str),
) {
    let duplicate_id_count = i.duplicate_id_count;
    let duplicate_ids = &i.duplicate_ids;
    let unresolved_aria_reference_count = i.unresolved_aria_reference_count;
    let unresolved_aria_references = &i.unresolved_aria_references;
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
}

pub(in crate::services::html_parser) fn attach_elements(
    findings: &mut [AccessibilityFinding],
    code: &str,
    elements: Vec<AccessibilityElementEvidence>,
) {
    if let Some(finding) = findings.iter_mut().find(|finding| finding.code == code) {
        finding.elements = elements;
    }
}
