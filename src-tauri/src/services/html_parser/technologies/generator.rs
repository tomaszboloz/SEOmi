use super::*;

pub(in crate::services::html_parser) fn generator_signals(
    generator: Option<&str>,
    signals: &mut Vec<TechnologySignal>,
) {
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
        if let Some((prefix, name)) = declared {
            let suffix = value.get(prefix.len()..).unwrap_or_default().trim_start();
            let version = parse_declared_version(suffix);
            push_signal(
                name,
                "CMS / platform",
                format!("meta[name=generator] explicitly declares {value}"),
                "confirmed",
                version,
                signals,
            );
        }
        push_signal(
            "Generator declared by page",
            "CMS / generator",
            format!("meta[name=generator]: {value}"),
            "confirmed",
            None,
            signals,
        );
    }
}
