use super::*;

pub(in crate::services::html_parser) fn semantic_content_root(element: &ElementRef<'_>) -> bool {
    let value = element.value();
    if matches!(value.name(), "main" | "article")
        || value
            .attr("role")
            .is_some_and(|role| role.eq_ignore_ascii_case("main"))
        || value
            .attr("itemprop")
            .is_some_and(|itemprop| itemprop.eq_ignore_ascii_case("articleBody"))
    {
        return true;
    }
    ["id", "class"].iter().any(|attribute| {
        value.attr(attribute).is_some_and(|value| {
            let compact = value
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .collect::<String>()
                .to_ascii_lowercase();
            ["maincontent", "articlebody", "postbody", "entrycontent"]
                .iter()
                .any(|marker| compact.contains(marker))
        })
    })
}

pub(in crate::services::html_parser) fn semantic_chrome_element(element: &ElementRef<'_>) -> bool {
    let value = element.value();
    if matches!(value.name(), "header" | "nav" | "footer" | "aside" | "form")
        || value.attr("hidden").is_some()
        || value.attr("inert").is_some()
        || aria_hidden_value(value.attr("aria-hidden"))
        || value.attr("style").is_some_and(semantic_style_hides)
        || value.attr("role").is_some_and(|role| {
            [
                "banner",
                "navigation",
                "contentinfo",
                "complementary",
                "form",
                "search",
            ]
            .iter()
            .any(|candidate| role.eq_ignore_ascii_case(candidate))
        })
    {
        return true;
    }
    ["id", "class"].iter().any(|attribute| {
        value.attr(attribute).is_some_and(|value| {
            value
                .split(|character: char| !character.is_ascii_alphanumeric())
                .map(str::to_ascii_lowercase)
                .any(|token| {
                    [
                        "header",
                        "footer",
                        "sidebar",
                        "side",
                        "navigation",
                        "navbar",
                        "navmenu",
                        "menu",
                        "breadcrumb",
                        "cookie",
                        "consent",
                        "banner",
                    ]
                    .contains(&token.as_str())
                })
        })
    })
}

pub(in crate::services::html_parser) fn semantic_content_contains(
    element: &ElementRef<'_>,
    has_primary_root: bool,
) -> bool {
    if semantic_chrome_element(element) {
        return false;
    }
    let mut in_primary_root = semantic_content_root(element);
    for ancestor in element.ancestors().filter_map(ElementRef::wrap) {
        if semantic_chrome_element(&ancestor) {
            return false;
        }
        in_primary_root |= semantic_content_root(&ancestor);
    }
    !has_primary_root || in_primary_root
}

pub(in crate::services::html_parser) fn has_semantic_content_root(document: &Html) -> bool {
    document
        .root_element()
        .descendants()
        .filter_map(ElementRef::wrap)
        .any(|element| {
            semantic_content_root(&element) && semantic_content_contains(&element, false)
        })
}
