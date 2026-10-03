use super::*;

pub(super) fn semantic_content_root(element: &ElementRef<'_>) -> bool {
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

pub(super) fn semantic_aria_hidden(value: Option<&str>) -> bool {
    value.is_some_and(|value| {
        matches!(
            value.trim().to_ascii_lowercase().as_str(),
            "true" | "1" | "yes"
        )
    })
}

pub(super) fn semantic_style_hides(value: &str) -> bool {
    value.split(';').any(|declaration| {
        let Some((property, raw_value)) = declaration.split_once(':') else {
            return false;
        };
        let property = property.trim().to_ascii_lowercase();
        let first_value = raw_value
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .trim_end_matches(';')
            .to_ascii_lowercase();
        let first_value = first_value
            .strip_suffix("!important")
            .unwrap_or(&first_value);
        matches!(
            (property.as_str(), first_value),
            ("display", "none") | ("visibility", "hidden") | ("content-visibility", "hidden")
        )
    })
}

pub(super) fn semantic_chrome_element(element: &ElementRef<'_>) -> bool {
    let value = element.value();
    if matches!(value.name(), "header" | "nav" | "footer" | "aside" | "form")
        || value.attr("hidden").is_some()
        || value.attr("inert").is_some()
        || semantic_aria_hidden(value.attr("aria-hidden"))
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

pub(super) fn semantic_content_contains(element: &ElementRef<'_>, has_primary_root: bool) -> bool {
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

pub(super) fn has_semantic_content_root(document: &Html) -> bool {
    document
        .root_element()
        .descendants()
        .filter_map(ElementRef::wrap)
        .filter(|element| !semantic_chrome_element(element))
        .any(|element| semantic_content_root(&element))
}
