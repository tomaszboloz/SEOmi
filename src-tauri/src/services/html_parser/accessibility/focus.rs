use super::*;

pub(in crate::services::html_parser) fn focus_elements(
    document: &Html,
    html_str: &str,
    add_finding: &mut impl FnMut(&str, &str, String, String, &str),
) -> Vec<AccessibilityElementEvidence> {
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
    aria_hidden_focusable_elements
}
