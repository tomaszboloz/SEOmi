use super::*;

pub(in crate::services::html_parser) fn source_tag_matches_selector(
    tag: &str,
    element_name: &str,
    selector: &str,
) -> bool {
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
