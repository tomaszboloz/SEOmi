use super::*;

pub(in crate::services::html_parser) fn content_metrics(
    words: &[String],
    full_text: &str,
    effective_language: Option<&str>,
) -> ContentStats {
    let word_count = words.len();
    let reading_time_minutes = if word_count == 0 {
        0
    } else {
        word_count.div_ceil(200)
    };
    let sentence_count = full_text
        .split(['.', '!', '?'])
        .filter(|sentence| sentence.chars().any(char::is_alphanumeric))
        .count();
    let average_words_per_sentence = if sentence_count == 0 {
        0.0
    } else {
        word_count as f32 / sentence_count as f32
    };
    let total_word_characters = words.iter().map(|word| word.chars().count()).sum::<usize>();
    let average_characters_per_word = if word_count == 0 {
        0.0
    } else {
        total_word_characters as f32 / word_count as f32
    };
    // A transparent, language-agnostic complexity heuristic. It only uses
    // sentence and token lengths; it is explicitly not Flesch, a grade level,
    // or a substitute for a linguistic readability assessment.
    let complexity_score = if word_count == 0 {
        0
    } else {
        (100.0
            - (average_words_per_sentence - 12.0).max(0.0) * 3.0
            - (average_characters_per_word - 5.0).max(0.0) * 8.0)
            .clamp(0.0, 100.0)
            .round() as u8
    };
    let complexity_label = if word_count == 0 {
        "unavailable"
    } else if complexity_score >= 75 {
        "simple"
    } else if complexity_score >= 45 {
        "moderate"
    } else {
        "complex"
    };

    let syllable_count = words
        .iter()
        .map(|word| estimate_readability_syllables(word))
        .sum::<usize>();
    let (readability_ease_score, readability_grade, readability_method) =
        if sentence_count == 0 || word_count == 0 {
            (0.0, 0.0, "unavailable")
        } else {
            readability_formula(
                effective_language,
                word_count,
                sentence_count,
                syllable_count,
            )
        };
    let readability_label = if word_count == 0 {
        "unavailable"
    } else if readability_ease_score >= 80.0 {
        "very-easy"
    } else if readability_ease_score >= 60.0 {
        "standard"
    } else if readability_ease_score >= 30.0 {
        "difficult"
    } else {
        "very-difficult"
    };
    ContentStats {
        word_count,
        reading_time_minutes,
        sentence_count,
        average_words_per_sentence,
        average_characters_per_word,
        complexity_score,
        readability_ease_score,
        readability_grade,
        complexity_label: complexity_label.to_string(),
        readability_method: readability_method.to_string(),
        readability_label: readability_label.to_string(),
        ..ContentStats::default()
    }
}
