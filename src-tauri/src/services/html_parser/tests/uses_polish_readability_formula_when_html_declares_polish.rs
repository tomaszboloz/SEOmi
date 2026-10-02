use super::*;

#[test]
fn uses_polish_readability_formula_when_html_declares_polish() {
    let polish = parse_html(
        "<html lang=\"pl-PL\"><body>To jest przykładowy tekst, który pokazuje polską formułę czytelności. Zdanie ma kilka słów i powinno otrzymać lokalny wzór.</body></html>",
        "https://example.com",
    )
    .unwrap();
    let english = parse_html(
        "<html lang=\"en\"><body>To jest przykładowy tekst, który pokazuje polską formułę czytelności. Zdanie ma kilka słów i powinno otrzymać lokalny wzór.</body></html>",
        "https://example.com",
    )
    .unwrap();

    assert_eq!(polish.content_stats.readability_method, "flesch-pl");
    assert_ne!(english.content_stats.readability_method, "flesch-pl");
    assert_ne!(
        polish.content_stats.readability_ease_score,
        english.content_stats.readability_ease_score
    );
}

#[test]
fn infers_polish_readability_formula_when_lang_is_missing() {
    let parsed = parse_html(
        "<html><body>To jest tekst, który pokazuje polską treść. Jest to kolejny fragment, który ma lokalny wzór.</body></html>",
        "https://example.com",
    )
    .unwrap();

    assert_eq!(parsed.content_stats.readability_method, "flesch-pl");
}

#[test]
fn selects_locale_specific_readability_formulas_for_supported_languages() {
    let body = "This is a bounded readability sample with several words in two sentences. It is deliberately long enough for the local formula.";
    for (language, expected) in [
        ("de", "flesch-de"),
        ("it", "flesch-it"),
        ("pt", "flesch-pt"),
        ("ru", "flesch-ru"),
    ] {
        let html = format!("<html lang=\"{language}\"><body>{body}</body></html>");
        let parsed = parse_html(&html, "https://example.com").unwrap();
        assert_eq!(
            parsed.content_stats.readability_method, expected,
            "language {language}"
        );
    }
}

#[test]
fn filters_common_supported_locale_stop_words_from_frequency_report() {
    let parsed = parse_html(
        "<html lang=\"de\"><body>und und der die das y y le le SEO SEO SEO</body></html>",
        "https://example.com",
    )
    .unwrap();
    let keywords = parsed
        .content_stats
        .top_keywords
        .iter()
        .map(|keyword| keyword.keyword.as_str())
        .collect::<Vec<_>>();
    assert!(keywords.contains(&"seo"));
    assert!(!keywords.contains(&"und"));
    assert!(!keywords.contains(&"der"));
    assert!(!keywords.contains(&"die"));
    assert!(!keywords.contains(&"das"));
    assert!(!keywords.contains(&"le"));
}

#[test]
fn detects_only_evidence_backed_html_technology_signals() {
    let parsed = parse_html(
        "<html><head><meta name=\"generator\" content=\"WordPress 6.6\"><script src=\"https://plausible.io/js/script.js\"></script></head><body><script src=\"/_next/app.js\"></script><img src=\"/wp-content/logo.png\"></body></html>",
        "https://example.com",
    )
    .unwrap();

    assert!(parsed
        .technical
        .technology_signals
        .iter()
        .any(|signal| signal.name == "WordPress"));
    assert!(parsed
        .technical
        .technology_signals
        .iter()
        .any(|signal| signal.name == "Next.js"));
    assert!(parsed
        .technical
        .technology_signals
        .iter()
        .any(|signal| signal.name == "Plausible Analytics" && signal.confidence == "confirmed"));
}

#[test]
fn detects_framework_and_library_markers_without_inventing_versions() {
    let parsed = parse_html(
        r#"<html><head><script src="/assets/jquery.min.js"></script><link rel="stylesheet" href="/css/bootstrap.min.css"></head><body><app-root ng-version="17.2.1" _nghost-a><div data-v-app data-svelte-h="abc"></div><div x-data="{}"></div></app-root></body></html>"#,
        "https://example.com",
    )
    .unwrap();

    let signal = |name: &str| {
        parsed
            .technical
            .technology_signals
            .iter()
            .find(|signal| signal.name == name)
            .unwrap_or_else(|| panic!("missing technology signal: {name}"))
    };
    assert_eq!(signal("Angular").confidence, "confirmed");
    assert_eq!(signal("Angular").version.as_deref(), Some("17.2.1"));
    assert_eq!(signal("jQuery").confidence, "confirmed");
    assert_eq!(signal("Bootstrap").confidence, "confirmed");
    assert_eq!(signal("Vue.js").confidence, "heuristic");
    assert_eq!(signal("Svelte").confidence, "heuristic");
    assert_eq!(signal("Alpine.js").confidence, "heuristic");
    assert!(signal("jQuery").version.is_none());
}

#[test]
fn does_not_treat_lookalike_framework_text_as_a_technology_marker() {
    let parsed = parse_html(
        "<html><head><script src=\"/js/notjquery.js\"></script><script src=\"/js/tailwindcss-like.js\"></script><link rel=\"stylesheet\" href=\"/css/bootstrapper.css\"></head><body><p>jquery is mentioned in an article; bootstrapper and tailwindcss-like are not assets</p></body></html>",
        "https://example.com",
    )
    .unwrap();
    assert!(!parsed
        .technical
        .technology_signals
        .iter()
        .any(|signal| matches!(
            signal.name.as_str(),
            "jQuery" | "Bootstrap" | "Tailwind CSS"
        )));
}
