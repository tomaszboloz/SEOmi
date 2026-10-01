use crate::models::audit_data::TechnologySignal;
use scraper::{Html, Selector};

pub(super) fn detect_html_technologies(
    document: &Html,
    html: &str,
    generator: Option<&str>,
) -> Vec<TechnologySignal> {
    let mut signals = Vec::new();
    let add = |name: &str,
               category: &str,
               evidence: String,
               confidence: &str,
               version: Option<String>,
               output: &mut Vec<TechnologySignal>| {
        if !output
            .iter()
            .any(|signal| signal.name == name && signal.category == category)
        {
            output.push(TechnologySignal {
                name: name.to_string(),
                category: category.to_string(),
                evidence,
                confidence: confidence.to_string(),
                version,
            });
        }
    };

    if let Some(value) = generator.filter(|value| !value.trim().is_empty()) {
        let value = value.trim();
        let known_generators = [
            ("WordPress", "WordPress"),
            ("Drupal", "Drupal"),
            ("Joomla!", "Joomla"),
            ("Joomla", "Joomla"),
            ("Ghost", "Ghost"),
            ("Shopify", "Shopify"),
            ("Wix", "Wix"),
            ("Squarespace", "Squarespace"),
            ("PrestaShop", "PrestaShop"),
            ("TYPO3", "TYPO3"),
        ];
        let declared = known_generators.iter().find(|(prefix, _)| {
            value
                .get(..prefix.len())
                .is_some_and(|candidate| candidate.eq_ignore_ascii_case(prefix))
                && value
                    .get(prefix.len()..)
                    .and_then(|remainder| remainder.chars().next())
                    .map_or(true, char::is_whitespace)
        });
        if let Some((_, name)) = declared {
            let (_, prefix) = declared.unwrap();
            let suffix = value.get(prefix.len()..).unwrap_or_default().trim_start();
            let version = parse_declared_version(suffix);
            add(
                name,
                "CMS / platform",
                format!("meta[name=generator] explicitly declares {value}"),
                "confirmed",
                version,
                &mut signals,
            );
        }
        add(
            "Generator declared by page",
            "CMS / generator",
            format!("meta[name=generator]: {value}"),
            "confirmed",
            None,
            &mut signals,
        );
    }

    let lower_html = html.to_ascii_lowercase();
    if !signals.iter().any(|signal| signal.name == "WordPress")
        && (lower_html.contains("/wp-content/") || lower_html.contains("/wp-includes/"))
    {
        add(
            "WordPress",
            "CMS",
            "HTML references /wp-content/ or /wp-includes/.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("cdn.shopify.com") || lower_html.contains("shopify.theme") {
        add(
            "Shopify",
            "Commerce platform",
            "HTML contains a Shopify asset or runtime marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("__next_data__") || lower_html.contains("/_next/") {
        add(
            "Next.js",
            "JavaScript framework",
            "HTML contains a Next.js document marker or asset path.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("data-reactroot") || lower_html.contains("data-react-root") {
        add(
            "React",
            "JavaScript framework",
            "HTML contains a React root marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("data-v-app") || lower_html.contains("__vue__") {
        add(
            "Vue.js",
            "JavaScript framework",
            "HTML contains a Vue application or component marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
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
        add(
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
            &mut signals,
        );
    }
    if lower_html.contains("data-svelte-h") {
        add(
            "Svelte",
            "JavaScript framework",
            "HTML contains a Svelte hydration marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("googletagmanager.com/gtm.js") || lower_html.contains("gtm-") {
        add(
            "Google Tag Manager",
            "Tag manager",
            "HTML contains a Google Tag Manager marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }
    if lower_html.contains("googletagmanager.com/gtag/js") || lower_html.contains("gtag(") {
        add(
            "Google tag",
            "Analytics / tag",
            "HTML contains a Google tag marker.".to_string(),
            "heuristic",
            None,
            &mut signals,
        );
    }

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
    let asset_starts_with = |source: &str, marker: &str| {
        let path = source.split(['?', '#']).next().unwrap_or(source);
        let filename = path.rsplit('/').next().unwrap_or(path);
        filename == marker
            || filename.strip_prefix(marker).is_some_and(|suffix| {
                if suffix.starts_with('.') {
                    return true;
                }
                let mut characters = suffix.chars();
                matches!(characters.next(), Some('-' | '_' | '@'))
                    && characters
                        .next()
                        .is_some_and(|character| character.is_ascii_digit())
            })
    };
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "jquery"))
    {
        add(
            "jQuery",
            "JavaScript library",
            "A script source explicitly references jQuery.".to_string(),
            "confirmed",
            None,
            &mut signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "alpinejs"))
        || lower_html.contains("x-data=")
    {
        add(
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
            &mut signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "bootstrap"))
        || linked_assets
            .iter()
            .any(|asset| asset_starts_with(asset, "bootstrap"))
    {
        add(
            "Bootstrap",
            "CSS / UI framework",
            "A linked stylesheet or script explicitly references Bootstrap.".to_string(),
            "confirmed",
            None,
            &mut signals,
        );
    }
    if script_sources
        .iter()
        .any(|source| asset_starts_with(source, "tailwindcss"))
        || linked_assets
            .iter()
            .any(|asset| asset_starts_with(asset, "tailwindcss"))
    {
        add(
            "Tailwind CSS",
            "CSS / UI framework",
            "HTML contains a Tailwind CSS asset or runtime marker.".to_string(),
            "confirmed",
            None,
            &mut signals,
        );
    }
    if document.select(&script_selector).any(|script| {
        script
            .value()
            .attr("src")
            .is_some_and(|src| src.contains("plausible.io"))
    }) {
        add(
            "Plausible Analytics",
            "Analytics",
            "A script source references plausible.io.".to_string(),
            "confirmed",
            None,
            &mut signals,
        );
    }

    signals
}

pub(super) fn parse_declared_version(value: &str) -> Option<String> {
    let value = value
        .strip_prefix('v')
        .or_else(|| value.strip_prefix('V'))
        .unwrap_or(value);
    let version: String = value
        .chars()
        .take_while(|character| character.is_ascii_digit() || *character == '.')
        .collect();
    let valid = !version.is_empty()
        && version
            .split('.')
            .all(|part| !part.is_empty() && part.parse::<u32>().is_ok())
        && value
            .chars()
            .nth(version.len())
            .map_or(true, char::is_whitespace);
    valid.then_some(version)
}
