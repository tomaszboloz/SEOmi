use super::*;

#[derive(Debug, Default)]
pub(super) struct ContentMetrics {
    pub(super) word_count: usize,
    pub(super) content_hash: Option<String>,
    pub(super) text_ratio_percent: Option<f64>,
    pub(super) reading_time_minutes: Option<usize>,
    pub(super) sentence_count: Option<usize>,
    pub(super) average_words_per_sentence: Option<f64>,
    pub(super) average_characters_per_word: Option<f64>,
    pub(super) complexity_score: Option<u8>,
    pub(super) complexity_label: Option<String>,
    pub(super) readability_ease_score: Option<f64>,
    pub(super) readability_grade: Option<f64>,
    pub(super) readability_method: Option<String>,
    pub(super) readability_label: Option<String>,
    pub(super) content_terms: Vec<CrawledContentTerm>,
}

pub(super) fn content_metrics(
    document: &Html,
    html_bytes: usize,
    language: Option<&str>,
) -> ContentMetrics {
    let (word_count, content_hash) = normalized_content_fingerprint(document);
    let text = semantic_content_text(document);
    if text.is_empty() {
        return ContentMetrics {
            word_count,
            content_hash,
            text_ratio_percent: (html_bytes > 0).then_some(0.0),
            reading_time_minutes: Some(0),
            ..ContentMetrics::default()
        };
    }
    let effective_language = language.or_else(|| infer_content_language(&text));

    let words = text
        .split_whitespace()
        .map(|token| {
            token
                .chars()
                .filter(|character| character.is_alphanumeric())
                .collect::<String>()
        })
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>();
    let measured_word_count = words.len();
    let sentence_count = text
        .split(['.', '!', '?'])
        .filter(|sentence| sentence.chars().any(char::is_alphanumeric))
        .count();
    let average_words_per_sentence =
        (sentence_count > 0).then_some(measured_word_count as f64 / sentence_count as f64);
    let average_characters_per_word = (measured_word_count > 0).then_some(
        words.iter().map(|word| word.chars().count()).sum::<usize>() as f64
            / measured_word_count as f64,
    );
    let syllable_count = words
        .iter()
        .map(|word| estimate_syllables(word))
        .sum::<usize>();
    let (readability_ease_score, readability_grade, readability_method) =
        if sentence_count > 0 && measured_word_count > 0 {
            let (ease, grade, method) = readability_formula(
                effective_language,
                measured_word_count,
                sentence_count,
                syllable_count,
            );
            (Some(ease), Some(grade), Some(method.to_string()))
        } else {
            (None, None, None)
        };
    let complexity_score = average_words_per_sentence
        .zip(average_characters_per_word)
        .map(|(words_per_sentence, characters_per_word)| {
            let score: f64 = 100.0
                - (words_per_sentence - 12.0).max(0.0) * 3.0
                - (characters_per_word - 5.0).max(0.0) * 8.0;
            score.clamp(0.0, 100.0).round() as u8
        });
    let complexity_label = complexity_score.map(|score| {
        if score >= 75 {
            "simple".to_string()
        } else if score >= 45 {
            "moderate".to_string()
        } else {
            "complex".to_string()
        }
    });
    let readability_label = readability_ease_score.map(readability_label);
    let content_terms = content_term_stats(document, effective_language);

    ContentMetrics {
        word_count,
        content_hash,
        text_ratio_percent: (html_bytes > 0)
            .then_some(((text.len() as f64 / html_bytes as f64) * 100.0).min(100.0)),
        reading_time_minutes: Some(word_count.div_ceil(200)),
        sentence_count: Some(sentence_count),
        average_words_per_sentence,
        average_characters_per_word,
        complexity_score,
        complexity_label,
        readability_ease_score,
        readability_grade,
        readability_method,
        readability_label,
        content_terms,
    }
}
