use super::*;

pub(in crate::services::html_parser) fn identity_elements(
    document: &Html,
    html_str: &str,
    ids: &HashSet<String>,
    duplicate_id_values: &HashSet<String>,
) -> (
    Vec<AccessibilityElementEvidence>,
    Vec<AccessibilityElementEvidence>,
) {
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

    (duplicate_id_elements, unresolved_aria_elements)
}
