use super::*;

pub(in crate::services::html_parser) fn marker_signals(
    document: &Html,
    lower_html: &str,
    signals: &mut Vec<TechnologySignal>,
) {
    if !signals.iter().any(|signal| signal.name == "WordPress")
        && (lower_html.contains("/wp-content/") || lower_html.contains("/wp-includes/"))
    {
        push_signal(
            "WordPress",
            "CMS",
            "HTML references /wp-content/ or /wp-includes/.".to_string(),
            "heuristic",
            None,
            signals,
        );
    }
    if lower_html.contains("cdn.shopify.com") || lower_html.contains("shopify.theme") {
        push_signal(
            "Shopify",
            "Commerce platform",
            "HTML contains a Shopify asset or runtime marker.".to_string(),
            "heuristic",
            None,
            signals,
        );
    }
    if lower_html.contains("__next_data__") || lower_html.contains("/_next/") {
        push_signal(
            "Next.js",
            "JavaScript framework",
            "HTML contains a Next.js document marker or asset path.".to_string(),
            "heuristic",
            None,
            signals,
        );
    }
    if lower_html.contains("data-reactroot") || lower_html.contains("data-react-root") {
        push_signal(
            "React",
            "JavaScript framework",
            "HTML contains a React root marker.".to_string(),
            "heuristic",
            None,
            signals,
        );
    }
    if lower_html.contains("data-v-app") || lower_html.contains("__vue__") {
        push_signal(
            "Vue.js",
            "JavaScript framework",
            "HTML contains a Vue application or component marker.".to_string(),
            "heuristic",
            None,
            signals,
        );
    }
    let angular_selector =
        Selector::parse("[ng-version]").expect("static Angular version selector is valid");
    let angular_version = document
        .select(&angular_selector)
        .filter_map(|element| element.value().attr("ng-version"))
        .find_map(parse_declared_version);
    if lower_html.contains("_nghost-")
        || lower_html.contains("_ngcontent-")
        || angular_version.is_some()
    {
        push_signal(
            "Angular",
            "JavaScript framework",
            if let Some(version) = angular_version.as_deref() {
                format!("ng-version explicitly declares Angular {version}.")
            } else {
                "HTML contains Angular host/content markers.".to_string()
            },
            if angular_version.is_some() {
                "confirmed"
            } else {
                "heuristic"
            },
            angular_version,
            signals,
        );
    }
    if lower_html.contains("data-svelte-h") {
        push_signal(
            "Svelte",
            "JavaScript framework",
            "HTML contains a Svelte hydration marker.".to_string(),
            "heuristic",
            None,
            signals,
        );
    }
    if lower_html.contains("googletagmanager.com/gtm.js") || lower_html.contains("gtm-") {
        push_signal(
            "Google Tag Manager",
            "Tag manager",
            "HTML contains a Google Tag Manager marker.".to_string(),
            "heuristic",
            None,
            signals,
        );
    }
    if lower_html.contains("googletagmanager.com/gtag/js") || lower_html.contains("gtag(") {
        push_signal(
            "Google tag",
            "Analytics / tag",
            "HTML contains a Google tag marker.".to_string(),
            "heuristic",
            None,
            signals,
        );
    }
}
