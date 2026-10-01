use super::*;

#[test]
fn content_metrics_returns_ratio_and_reading_time_for_html() {
    let document = Html::parse_document("<html><body>one two three</body></html>");
    let metrics = content_metrics(&document, 50, Some("en"));
    assert_eq!(metrics.word_count, 3);
    assert!(metrics.text_ratio_percent.is_some_and(|value| value > 0.0));
    assert_eq!(metrics.reading_time_minutes, Some(1));
    assert_eq!(metrics.sentence_count, Some(1));
    assert_eq!(metrics.average_words_per_sentence, Some(3.0));
    assert!(metrics
        .average_characters_per_word
        .is_some_and(|value| value > 3.0));
    assert_eq!(metrics.complexity_score, Some(100));
    assert_eq!(metrics.complexity_label.as_deref(), Some("simple"));
    assert!(metrics.readability_ease_score.is_some());
    assert!(metrics.readability_grade.is_some());
    assert!(metrics.readability_label.is_some());
}

#[test]
fn content_metrics_uses_document_language_for_readability() {
    let document = Html::parse_document(
            "<html lang=\"pl\"><body><main>To jest przykładowy tekst, który pokazuje polską formułę czytelności. Zdanie ma kilka słów i powinno otrzymać lokalny wzór.</main></body></html>",
        );
    let polish = content_metrics(&document, 220, Some("pl-PL"));
    let english = content_metrics(&document, 220, Some("en-US"));

    assert_eq!(polish.readability_method.as_deref(), Some("flesch-pl"));
    assert_eq!(english.readability_method.as_deref(), Some("flesch-en"));
    assert_ne!(
        polish.readability_ease_score, english.readability_ease_score,
        "Polish text must not silently use the English coefficient"
    );
}

#[test]
fn content_metrics_infers_polish_when_lang_is_missing() {
    let document = Html::parse_document(
            "<html><body><main>To jest tekst, który pokazuje polską treść. Jest to kolejny fragment, który ma lokalny wzór.</main></body></html>",
        );
    let metrics = content_metrics(&document, 220, None);

    assert_eq!(metrics.readability_method.as_deref(), Some("flesch-pl"));
}

#[test]
fn content_metrics_excludes_site_chrome_from_content_signals() {
    let document = Html::parse_document(
            "<html><body><header>navigation words</header><aside>sidebar words</aside><main><p>one two three.</p></main><footer>footer words</footer></body></html>",
        );
    let metrics = content_metrics(&document, 180, Some("en"));

    assert_eq!(metrics.word_count, 3);
    assert_eq!(metrics.sentence_count, Some(1));
    assert_eq!(metrics.average_words_per_sentence, Some(3.0));
    let expected = Html::parse_document("<html><body><main>one two three.</main></body></html>");
    assert_eq!(
        metrics.content_hash,
        normalized_content_fingerprint(&expected).1
    );
}

#[test]
fn content_metrics_reports_bounded_term_density() {
    let document = Html::parse_document(
            "<html><body><header>espresso navigation</header><main>espresso espresso brewing coffee</main><footer>espresso footer</footer></body></html>",
        );
    let metrics = content_metrics(&document, 150, Some("en"));

    assert_eq!(
        metrics.content_terms.first().map(|term| term.term.as_str()),
        Some("espresso")
    );
    assert_eq!(
        metrics.content_terms.first().map(|term| term.count),
        Some(2)
    );
    assert!(metrics
        .content_terms
        .first()
        .is_some_and(|term| (term.density_percent - 50.0).abs() < 0.01));
    assert!(!metrics
        .content_terms
        .iter()
        .any(|term| term.term == "navigation"));
}

#[test]
fn focus_phrase_evidence_reports_content_and_metadata_locations() {
    let document = Html::parse_document(
            "<html><head><title>Technical SEO audit</title><meta name=\"description\" content=\"Technical SEO audit guide\"></head><body><header>Technical SEO audit navigation</header><main><h1>Technical SEO audit</h1><p>Technical SEO audit helps teams find issues.</p></main></body></html>",
        );
    let evidence = focus_phrase_evidence(
        &document,
        Some("Technical SEO audit"),
        Some("Technical SEO audit guide"),
        Some("technical seo audit"),
    )
    .expect("phrase evidence should be available");

    assert_eq!(evidence.body_occurrences, 2);
    assert_eq!(evidence.title_occurrences, 1);
    assert_eq!(evidence.meta_description_occurrences, 1);
    assert_eq!(evidence.h1_occurrences, 1);
    assert!(evidence.body_density_percent > 0.0);
}
