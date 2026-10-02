use super::*;

pub(in crate::services::html_parser) struct ControlInventory {
    pub(in crate::services::html_parser) form_control_count: usize,
    pub(in crate::services::html_parser) unlabeled_form_control_count: usize,
    pub(in crate::services::html_parser) hidden_form_control_count: usize,
    pub(in crate::services::html_parser) hidden_form_controls: Vec<AccessibilityElementEvidence>,
    pub(in crate::services::html_parser) anti_spam_text_control_count: usize,
    pub(in crate::services::html_parser) anti_spam_text_controls: Vec<AccessibilityElementEvidence>,
    pub(in crate::services::html_parser) anti_spam_non_text_control_count: usize,
    pub(in crate::services::html_parser) anti_spam_non_text_controls:
        Vec<AccessibilityElementEvidence>,
    pub(in crate::services::html_parser) unlabeled_form_controls: Vec<AccessibilityElementEvidence>,
}

pub(in crate::services::html_parser) fn control_inventory(
    document: &Html,
    html_str: &str,
    labels_for: &HashSet<&str>,
    nonempty_id_names: &HashSet<String>,
) -> ControlInventory {
    let controls_selector =
        Selector::parse("input, select, textarea").expect("static controls selector is valid");
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
    ControlInventory {
        form_control_count,
        unlabeled_form_control_count,
        hidden_form_control_count,
        hidden_form_controls,
        anti_spam_text_control_count,
        anti_spam_text_controls,
        anti_spam_non_text_control_count,
        anti_spam_non_text_controls,
        unlabeled_form_controls,
    }
}
