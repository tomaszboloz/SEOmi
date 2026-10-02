use super::*;

#[test]
fn tokenization_preserves_legacy_minimum_byte_length_and_normalization() {
    assert_eq!(
        content_words("Word, WORD! x 12 123 ąę"),
        vec!["word", "word", "123", "ąę"]
    );
    assert!(content_words("").is_empty());
}

#[test]
fn frequency_uses_total_word_density_and_never_divides_when_no_keywords_exist() {
    let words = ["brand", "brand", "the", "oraz"].map(str::to_string);
    let keywords = content_keywords(&words);
    assert_eq!(keywords.len(), 1);
    assert_eq!(keywords[0].keyword, "brand");
    assert_eq!(keywords[0].count, 2);
    assert_eq!(keywords[0].density_percent, 50.0);
    assert!(content_keywords(&[]).is_empty());
    assert!(content_keywords(&["the".into()]).is_empty());
    let many = (0..20).map(|i| format!("word{i}")).collect::<Vec<_>>();
    assert_eq!(content_keywords(&many).len(), 10);
}

#[test]
fn metrics_report_real_zeros_and_distinguish_simple_moderate_and_complex_text() {
    let empty = content_metrics(&[], "", Some("en"));
    assert_eq!(empty.word_count, 0);
    assert_eq!(empty.reading_time_minutes, 0);
    assert_eq!(empty.sentence_count, 0);
    assert_eq!(empty.complexity_label, "unavailable");
    assert_eq!(empty.readability_label, "unavailable");
    for (count, label) in [(10, "simple"), (21, "moderate"), (100, "complex")] {
        let words = vec!["brand".to_string(); count];
        let stats = content_metrics(&words, &words.join(" "), Some("en"));
        assert_eq!(stats.complexity_label, label);
        assert_eq!(stats.sentence_count, 1);
        assert_eq!(stats.average_words_per_sentence, count as f32);
        assert_eq!(stats.average_characters_per_word, 5.0);
        assert_eq!(stats.word_count, count);
        assert!(stats.readability_ease_score.is_finite());
    }
}

#[test]
fn extractor_bounds_unicode_text_and_handles_fragment_empty_and_zero_html_bytes() {
    let source = format!("<main>{}</main>", "ą".repeat(200_001));
    let document = Html::parse_document(&source);
    let stats = extract_content_stats(&document, 0, None);
    assert_eq!(stats.body_text.chars().count(), 200_000);
    assert!(stats.body_text_truncated);
    assert_eq!(stats.text_ratio_percent, 0.0);
    let stats = extract_content_stats(&Html::parse_document("<main>brand</main>"), 1, Some("en"));
    assert_eq!(stats.text_ratio_percent, 100.0);
    assert!(!stats.body_text_truncated);
    let empty = extract_content_stats(&Html::parse_fragment("<p>brand</p>"), 20, Some("en"));
    assert_eq!(empty.word_count, 0);
    assert_eq!(empty.body_text, "");
}

#[test]
fn readability_labels_follow_score_ranges_and_punctuation_only_has_no_sentences() {
    for (count, label) in [
        (10, "very-easy"),
        (50, "standard"),
        (75, "difficult"),
        (100, "very-difficult"),
    ] {
        let words = vec!["brand".to_string(); count];
        let stats = content_metrics(&words, &words.join(" "), Some("en"));
        assert_eq!(stats.readability_label, label);
    }
    let stats = content_metrics(&["brand".into()], "...?!", Some("en"));
    assert_eq!(stats.sentence_count, 0);
    assert_eq!(stats.average_words_per_sentence, 0.0);
    assert_eq!(stats.readability_method, "unavailable");
}
