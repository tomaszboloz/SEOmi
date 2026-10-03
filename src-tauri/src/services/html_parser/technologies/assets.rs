use super::*;

pub(in crate::services::html_parser) fn asset_signals(
    document: &Html,
    lower_html: &str,
    signals: &mut Vec<TechnologySignal>,
) {
    let script_selector = Selector::parse("script[src]").expect("static script selector is valid");
    let script_sources = document
        .select(&script_selector)
        .filter_map(|script| script.value().attr("src"))
        .map(str::to_ascii_lowercase)
        .collect::<Vec<_>>();
    let stylesheet_selector = Selector::parse("link[href]").expect("static link selector is valid");
    let linked_assets = document
        .select(&stylesheet_selector)
        .filter_map(|link| link.value().attr("href"))
        .map(str::to_ascii_lowercase)
        .collect::<Vec<_>>();
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "jquery"))
    {
        push_signal(
            "jQuery",
            "JavaScript library",
            "A script source explicitly references jQuery.".to_string(),
            "confirmed",
            None,
            signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "alpinejs"))
        || lower_html.contains("x-data=")
    {
        push_signal(
            "Alpine.js",
            "JavaScript framework",
            "HTML contains an Alpine.js asset or x-data directive.".to_string(),
            if script_sources
                .iter()
                .any(|source| asset_starts_with(source, "alpinejs"))
            {
                "confirmed"
            } else {
                "heuristic"
            },
            None,
            signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "bootstrap"))
        || linked_assets
            .iter()
            .any(|asset| asset_starts_with(asset, "bootstrap"))
    {
        push_signal(
            "Bootstrap",
            "CSS / UI framework",
            "A linked stylesheet or script explicitly references Bootstrap.".to_string(),
            "confirmed",
            None,
            signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "tailwindcss"))
        || linked_assets
            .iter()
            .any(|asset| asset_starts_with(asset, "tailwindcss"))
    {
        push_signal(
            "Tailwind CSS",
            "CSS / UI framework",
            "HTML contains a Tailwind CSS asset or runtime marker.".to_string(),
            "confirmed",
            None,
            signals,
        );
    }
    if document.select(&script_selector).any(|script| {
        script
            .value()
            .attr("src")
            .is_some_and(plausible_script_source)
    }) {
        push_signal(
            "Plausible Analytics",
            "Analytics",
            "A script source references plausible.io.".to_string(),
            "confirmed",
            None,
            signals,
        );
    }
}
