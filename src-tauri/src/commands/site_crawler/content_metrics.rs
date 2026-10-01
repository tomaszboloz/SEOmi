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

pub(super) fn estimate_syllables(word: &str) -> usize {
    let normalized = word.to_lowercase();
    let mut count = 0;
    let mut previous_vowel = false;
    for character in normalized.chars() {
        let vowel = matches!(
            character,
            'a' | 'e' | 'i' | 'o' | 'u' | 'y' | 'ą' | 'ę' | 'ó' | 'à' | 'è' | 'ì' | 'ò' | 'ù'
        );
        if vowel && !previous_vowel {
            count += 1;
        }
        previous_vowel = vowel;
    }
    if normalized.chars().count() > 2
        && normalized.ends_with('e')
        && count > 1
        && !normalized.ends_with("le")
    {
        count -= 1;
    }
    count.max(1)
}

pub(super) fn readability_label(score: f64) -> String {
    if score >= 80.0 {
        "very-easy".into()
    } else if score >= 60.0 {
        "standard".into()
    } else if score >= 30.0 {
        "difficult".into()
    } else {
        "very-difficult".into()
    }
}

pub(super) fn normalized_language(language: Option<&str>) -> Option<&str> {
    language
        .and_then(|value| value.split(['-', '_']).next())
        .filter(|value| !value.is_empty())
}

pub(super) fn readability_formula(
    language: Option<&str>,
    words: usize,
    sentences: usize,
    syllables: usize,
) -> (f64, f64, &'static str) {
    let words_per_sentence = words as f64 / sentences as f64;
    let syllables_per_word = syllables as f64 / words as f64;
    match normalized_language(language) {
        // Adapted Flesch for Polish (Pisarek/Król). Polish syllable density
        // is higher than English, so its coefficient is intentionally lower.
        Some("pl") => (
            (206.835 - 0.65 * words_per_sentence - 62.3 * syllables_per_word).clamp(0.0, 100.0),
            (0.4 * (words_per_sentence + 100.0 * syllables_per_word)).clamp(0.0, 100.0),
            "flesch-pl",
        ),
        Some("es") => (
            (206.84 - 1.02 * words_per_sentence - 60.0 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-es",
        ),
        Some("fr") => (
            (207.0 - 1.015 * words_per_sentence - 73.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-fr",
        ),
        Some("en") | None => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).clamp(0.0, 100.0),
            "flesch-en",
        ),
        _ => (
            (206.835 - 1.015 * words_per_sentence - 84.6 * syllables_per_word).clamp(0.0, 100.0),
            (0.39 * words_per_sentence + 11.8 * syllables_per_word - 15.59).max(0.0),
            "flesch-like",
        ),
    }
}

pub(super) fn content_term_stats(
    document: &Html,
    language: Option<&str>,
) -> Vec<CrawledContentTerm> {
    const STOP_WORDS: &[&str] = &[
        "the", "and", "for", "with", "from", "that", "this", "your", "you", "are", "was", "have",
        "has", "will", "into", "about", "our", "their", "they", "what", "when", "where", "which",
        "who", "how", "can", "not", "but", "all", "one", "more", "use", "now", "get", "www",
        "http", "https", "oraz", "jest", "się", "dla", "nie", "jak", "który", "która", "które",
        "przez", "aby", "ten", "tej", "jego", "jej", "czy", "lub", "bez", "nad", "pod", "przy",
        "tym", "także", "może", "mogą", "und", "der", "die", "das", "ein", "eine", "ist", "für",
        "mit", "von", "den", "des", "los", "las", "una", "uno", "para", "por", "con", "que", "del",
        "est", "les", "une", "des", "pour", "avec", "dans", "est", "gli", "che", "una", "per",
        "con", "sono", "della", "uma", "para", "com", "que", "dos", "das", "uma", "как", "это",
        "для", "что", "как", "или", "при", "есть",
    ];
    let normalized_tokens = semantic_content_text(document)
        .split(|character: char| !character.is_alphanumeric())
        .map(str::to_lowercase)
        .collect::<Vec<_>>();
    let total = normalized_tokens.len() as f64;
    let tokens = normalized_tokens
        .into_iter()
        .filter(|token| {
            token.chars().count() >= 3
                && !STOP_WORDS.contains(&token.as_str())
                && !(normalized_language(language) == Some("pl")
                    && matches!(
                        token.as_str(),
                        "te" | "ta"
                            | "to"
                            | "na"
                            | "do"
                            | "od"
                            | "po"
                            | "za"
                            | "ze"
                            | "we"
                            | "w"
                            | "z"
                            | "i"
                            | "że"
                            | "ale"
                            | "więcej"
                            | "czytaj"
                            | "twojej"
                    ))
        })
        .collect::<Vec<_>>();
    if tokens.is_empty() {
        return Vec::new();
    }
    let mut frequencies = HashMap::<String, usize>::new();
    for token in tokens {
        *frequencies.entry(token).or_default() += 1;
    }
    let mut terms = frequencies.into_iter().collect::<Vec<_>>();
    terms.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    terms
        .into_iter()
        .take(20)
        .map(|(term, count)| CrawledContentTerm {
            term,
            count,
            density_percent: count as f64 / total * 100.0,
        })
        .collect()
}

/// Conservative language inference used only when the page omits `html[lang]`.
/// It selects a heuristic but never invents the persisted document language.
pub(super) fn infer_content_language(text: &str) -> Option<&'static str> {
    const MARKERS: &[(&str, &[&str])] = &[
        ("en", &["the", "and", "with", "from", "this", "that"]),
        (
            "pl",
            &[
                "jest", "oraz", "się", "dla", "który", "które", "może", "mogą",
            ],
        ),
        ("de", &["und", "der", "die", "das", "mit", "nicht", "eine"]),
        (
            "es",
            &["que", "para", "con", "una", "los", "las", "del", "está"],
        ),
        ("fr", &["les", "des", "pour", "avec", "dans", "une", "est"]),
        ("it", &["gli", "che", "una", "per", "con", "sono", "della"]),
        ("pt", &["uma", "para", "com", "que", "dos", "das", "não"]),
        ("ru", &["это", "для", "что", "как", "или", "при", "есть"]),
    ];
    let mut scores = MARKERS
        .iter()
        .map(|(language, _)| (*language, 0usize))
        .collect::<Vec<_>>();
    for token in text
        .split(|character: char| !character.is_alphanumeric())
        .map(str::to_lowercase)
    {
        if token.is_empty() {
            continue;
        }
        for (index, (_, markers)) in MARKERS.iter().enumerate() {
            if markers.contains(&token.as_str()) {
                scores[index].1 += 1;
            }
        }
    }
    scores.sort_by_key(|left| std::cmp::Reverse(left.1));
    let best = scores.first()?;
    let second = scores.get(1).map(|entry| entry.1).unwrap_or(0);
    (best.1 >= 2 && best.1 > second).then_some(best.0)
}

pub(super) fn phrase_occurrences(text: &str, phrase: &str) -> usize {
    let normalized_phrase = phrase.trim().to_lowercase();
    if normalized_phrase.is_empty() {
        return 0;
    }
    text.to_lowercase()
        .match_indices(&normalized_phrase)
        .count()
}

pub(super) fn focus_phrase_evidence(
    document: &Html,
    title: Option<&str>,
    meta_description: Option<&str>,
    phrase: Option<&str>,
) -> Option<CrawledFocusPhraseEvidence> {
    let phrase = phrase?.trim();
    if phrase.is_empty() {
        return None;
    }
    let body = semantic_content_text(document);
    let body_occurrences = phrase_occurrences(&body, phrase);
    let token_count = body.split_whitespace().count();
    let title_occurrences = phrase_occurrences(title.unwrap_or_default(), phrase);
    let meta_description_occurrences =
        phrase_occurrences(meta_description.unwrap_or_default(), phrase);
    let h1_selector = Selector::parse("h1").expect("static h1 selector is valid");
    let h1_text = document
        .select(&h1_selector)
        .map(|element| element.text().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join(" ");
    Some(CrawledFocusPhraseEvidence {
        phrase: phrase.to_string(),
        body_occurrences,
        body_density_percent: if token_count == 0 {
            0.0
        } else {
            body_occurrences as f64 / token_count as f64 * 100.0
        },
        title_occurrences,
        meta_description_occurrences,
        h1_occurrences: phrase_occurrences(&h1_text, phrase),
    })
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
