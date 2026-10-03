use super::*;

pub(in crate::services::html_parser) fn image_elements(
    document: &Html,
    html_str: &str,
    add_finding: &mut impl FnMut(&str, &str, String, String, &str),
) -> Vec<AccessibilityElementEvidence> {
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
    images_without_alt_elements
}
