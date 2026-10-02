use super::*;

pub(in crate::services::html_parser) fn interactive_elements(
    document: &Html,
    html_str: &str,
    nonempty_id_names: &HashSet<String>,
    add_finding: &mut impl FnMut(&str, &str, String, String, &str),
) -> Vec<AccessibilityElementEvidence> {
    const NAMED_ELEMENTS_SELECTOR: &str = "a[href], button, input[type='button'], input[type='submit'], input[type='reset'], [role='button'], [role='link'], [role='checkbox'], [role='radio'], [role='switch'], [role='tab'], [role='menuitem']";
    let named_elements_selector =
        Selector::parse(NAMED_ELEMENTS_SELECTOR).expect("static named-element selector is valid");
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
    unnamed_interactive_elements
}
