use super::*;

pub(in crate::services::html_parser) fn extract_accessibility(
    document: &Html,
    html_str: &str,
) -> AccessibilityAudit {
    let (document_language, labels_for) = document_metadata(document);
    let inventory = identity_inventory(document);
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
    document_findings(
        document_language.as_deref(),
        &inventory.landmark_counts,
        &mut add_finding,
    );
    let (html_elements, main_landmark_elements) = document_elements(document, html_str);
    let controls = control_inventory(
        document,
        html_str,
        &labels_for,
        &inventory.nonempty_id_names,
    );
    control_findings(&controls, &mut add_finding);
    identity_findings(&inventory, &mut add_finding);
    let (duplicate_id_elements, unresolved_aria_elements) = identity_elements(
        document,
        html_str,
        &inventory.ids,
        &inventory.duplicate_id_values,
    );
    let aria_hidden_focusable_elements = focus_elements(document, html_str, &mut add_finding);
    let unnamed_interactive_elements = interactive_elements(
        document,
        html_str,
        &inventory.nonempty_id_names,
        &mut add_finding,
    );
    let images_without_alt_elements = image_elements(document, html_str, &mut add_finding);
    let IdentityInventory {
        landmark_counts,
        aria_attribute_count,
        ..
    } = inventory;
    let ControlInventory {
        form_control_count,
        unlabeled_form_control_count,
        hidden_form_control_count,
        hidden_form_controls,
        anti_spam_text_control_count,
        anti_spam_text_controls,
        anti_spam_non_text_control_count: _,
        anti_spam_non_text_controls,
        unlabeled_form_controls,
        ..
    } = controls;
    attach_elements(
        &mut findings,
        "accessibility-form-controls-unlabeled",
        unlabeled_form_controls,
    );
    attach_elements(
        &mut findings,
        "accessibility-antispam-control-not-text",
        anti_spam_non_text_controls,
    );
    attach_elements(
        &mut findings,
        "accessibility-interactive-name-missing",
        unnamed_interactive_elements,
    );
    attach_elements(
        &mut findings,
        "accessibility-focusable-aria-hidden",
        aria_hidden_focusable_elements,
    );
    attach_elements(
        &mut findings,
        "accessibility-image-alt-missing",
        images_without_alt_elements,
    );
    attach_elements(
        &mut findings,
        "accessibility-duplicate-id",
        duplicate_id_elements,
    );
    attach_elements(
        &mut findings,
        "accessibility-aria-reference-unresolved",
        unresolved_aria_elements,
    );
    attach_elements(
        &mut findings,
        "accessibility-document-language-invalid",
        html_elements,
    );
    attach_elements(
        &mut findings,
        "accessibility-multiple-main-landmarks",
        main_landmark_elements,
    );
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
