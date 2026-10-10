use super::*;

fn detected_names(html: &str) -> Vec<String> {
    detect_html_technologies(&Html::parse_document(html), html, None)
        .into_iter()
        .map(|signal| signal.name)
        .collect()
}

#[test]
fn marker_detection_accepts_each_supported_alternative() {
    for (html, expected) in [
        ("/wp-content/", "WordPress"),
        ("/wp-includes/", "WordPress"),
        ("cdn.shopify.com", "Shopify"),
        ("shopify.theme", "Shopify"),
        ("__NEXT_DATA__", "Next.js"),
        ("/_next/", "Next.js"),
        ("data-reactroot", "React"),
        ("data-react-root", "React"),
        ("data-v-app", "Vue.js"),
        ("__vue__", "Vue.js"),
        ("_ngcontent-a", "Angular"),
        ("data-svelte-h", "Svelte"),
        ("googletagmanager.com/gtm.js", "Google Tag Manager"),
        ("gtm-ABC", "Google Tag Manager"),
        ("googletagmanager.com/gtag/js", "Google tag"),
        ("gtag(", "Google tag"),
    ] {
        assert!(
            detected_names(html).iter().any(|name| name == expected),
            "{html}"
        );
    }
}

#[test]
fn marker_detection_does_not_accept_partial_or_lookalike_tokens() {
    let html = concat!(
        "/wp-content /wp-includes cdn.shopify.net shopify-theme __next_data_ ",
        "/next/ data-react-rooted data-v-appx __vuex _ngcontent data-svelte ",
        "googletagmanager.com/gtm gtm_ googletagmanager.com/gtag gtag"
    );
    assert!(detected_names(html).is_empty());
}

#[test]
fn marker_detection_handles_case_insensitive_markup_and_declared_angular_version() {
    let html = "<div NG-VERSION='16.2' DATA-REACTROOT></div>";
    let signals = detect_html_technologies(&Html::parse_document(html), html, None);
    let angular = signals
        .iter()
        .find(|signal| signal.name == "Angular")
        .unwrap();
    assert_eq!(angular.confidence, "confirmed");
    assert_eq!(angular.version.as_deref(), Some("16.2"));
    assert!(signals.iter().any(|signal| signal.name == "React"));
}
