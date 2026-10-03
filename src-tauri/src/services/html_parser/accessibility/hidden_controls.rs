use super::*;

pub(in crate::services::html_parser) fn is_hidden_conventional_anti_spam_field(
    control: &ElementRef<'_>,
) -> bool {
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
