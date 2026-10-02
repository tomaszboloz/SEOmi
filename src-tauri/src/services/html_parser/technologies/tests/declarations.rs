use super::*;

#[test]
fn signal_identity_deduplicates_only_matching_name_and_category() {
    let mut signals = Vec::new();
    push_signal(
        "Name",
        "Category",
        "first".into(),
        "confirmed",
        Some("1".into()),
        &mut signals,
    );
    push_signal(
        "Name",
        "Category",
        "second".into(),
        "heuristic",
        None,
        &mut signals,
    );
    push_signal(
        "Name",
        "Other",
        "other".into(),
        "confirmed",
        None,
        &mut signals,
    );
    assert_eq!(signals.len(), 2);
    assert_eq!(signals[0].evidence, "first");
    assert_eq!(signals[0].version.as_deref(), Some("1"));
}

#[test]
fn generator_prefixes_preserve_declared_versions_and_do_not_guess_lookalikes() {
    for (value, name) in [
        ("WordPress 6.8", "WordPress"),
        ("Drupal 11", "Drupal"),
        ("Joomla! 5.3", "Joomla"),
        ("Ghost v6", "Ghost"),
        ("Shopify 2", "Shopify"),
        ("Wix 1", "Wix"),
        ("Squarespace 7", "Squarespace"),
        ("PrestaShop 8", "PrestaShop"),
        ("TYPO3 13", "TYPO3"),
    ] {
        let mut signals = Vec::new();
        generator_signals(Some(value), &mut signals);
        assert_eq!(signals.len(), 2, "{value}");
        assert_eq!(signals[0].name, name);
        assert!(signals[0].version.is_some());
        assert_eq!(signals[0].confidence, "confirmed");
    }
    let mut signals = Vec::new();
    generator_signals(Some("WordPressLookalike 6"), &mut signals);
    assert_eq!(signals.len(), 1);
    assert_eq!(signals[0].name, "Generator declared by page");
    signals.clear();
    generator_signals(None, &mut signals);
    generator_signals(Some(" "), &mut signals);
    assert!(signals.is_empty());
}

#[test]
fn version_tokens_require_complete_numeric_components_and_word_boundary() {
    for (value, expected) in [("1", "1"), ("v5.3", "5.3"), ("V6.8 note", "6.8")] {
        assert_eq!(parse_declared_version(value).as_deref(), Some(expected));
    }
    for value in [
        "",
        "abc",
        "1.",
        ".1",
        "1..2",
        "1.2beta",
        "4294967296",
        " v1",
    ] {
        assert!(parse_declared_version(value).is_none(), "{value}");
    }
}

#[test]
fn markup_markers_distinguish_confirmed_angular_from_heuristics_and_preserve_cms_priority() {
    let html = "<div ng-version='16.2' data-reactroot data-v-app data-svelte-h='x'>/_next/ cdn.shopify.com googletagmanager.com/gtm.js gtag( /wp-content/</div>";
    let document = Html::parse_document(html);
    let mut signals = Vec::new();
    marker_signals(&document, html, &mut signals);
    for name in [
        "WordPress",
        "Shopify",
        "Next.js",
        "React",
        "Vue.js",
        "Angular",
        "Svelte",
        "Google Tag Manager",
        "Google tag",
    ] {
        assert!(signals.iter().any(|signal| signal.name == name), "{name}");
    }
    assert_eq!(
        signals
            .iter()
            .find(|s| s.name == "Angular")
            .unwrap()
            .version
            .as_deref(),
        Some("16.2")
    );
    signals.clear();
    generator_signals(Some("WordPress 6.8"), &mut signals);
    marker_signals(&document, "/wp-content/ _nghost-x", &mut signals);
    assert_eq!(signals.iter().filter(|s| s.name == "WordPress").count(), 1);
    let output = detect_html_technologies(&Html::parse_document(""), "", None);
    assert!(output.is_empty());
}

#[test]
fn angular_host_markers_are_heuristic_without_declared_version() {
    let document = Html::parse_document("<div _nghost-x></div>");
    let mut signals = Vec::new();
    marker_signals(&document, "_nghost-x", &mut signals);
    assert_eq!(signals.len(), 1);
    assert_eq!(signals[0].name, "Angular");
    assert_eq!(signals[0].confidence, "heuristic");
    assert!(signals[0].version.is_none());
    assert!(signals[0].evidence.contains("host/content"));
}
